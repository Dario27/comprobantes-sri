import fs from 'node:fs';
import path from 'node:path';
import bcryptjs from 'bcryptjs';
import { createDb, type DbInstance } from './storage/db';
import { createCompaniesRepo, type CompaniesRepo } from './storage/companies';
import { createJobRunsRepo, type JobRunsRepo } from './storage/jobRuns';
import { createUsuariosRepo, type UsuariosRepo } from './storage/usuarios';
import { createLogsRepo, type LogsRepo } from './storage/logs';
import { childLogger } from './logging';

const log = childLogger('bootstrap');

interface Bootstrap {
  db: DbInstance;
  downloadDir: string;
  companies: CompaniesRepo;
  jobRuns: JobRunsRepo;
  usuarios: UsuariosRepo;
  logs: LogsRepo;
}

const globalAny = globalThis as unknown as { __sriBoot?: Bootstrap; __sriSchedulerBooted?: boolean };

if (!globalAny.__sriBoot) {
  const dbPath = process.env.DB_PATH ?? path.resolve(process.cwd(), 'data/sri.sqlite');
  const downloadDir = process.env.DOWNLOAD_DIR ?? path.resolve(process.cwd(), 'downloads');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(downloadDir, { recursive: true });
  const db = createDb(dbPath);
  const companies = createCompaniesRepo(db);
  const jobRuns = createJobRunsRepo(db);
  const usuarios = createUsuariosRepo(db);
  const logs = createLogsRepo(db);
  globalAny.__sriBoot = { db, downloadDir, companies, jobRuns, usuarios, logs };

  // Seed async en background (bcrypt es la única parte async).
  void (async () => {
    try {
      const existentes = usuarios.list();
      if (existentes.length === 0) {
        const adminUser = process.env.ADMIN_USER ?? 'admin';
        const adminPass = process.env.ADMIN_PASS;
        if (adminPass) {
          const hash = await bcryptjs.hash(adminPass, 12);
          usuarios.create({ username: adminUser, passwordHash: hash, rol: 'superadmin' });
          log.info({ username: adminUser }, 'seed_superadmin_created');
        } else {
          log.warn('ADMIN_PASS no configurado en .env; tabla usuarios vacía — no se puede hacer login');
        }
      }
    } catch (err) {
      log.error({ err: (err as Error).message }, 'seed_superadmin_failed');
    }
  })();
}

if (!globalAny.__sriBoot) throw new Error('Bootstrap fallido: __sriBoot no inicializado');
export const boot: Bootstrap = globalAny.__sriBoot;

// Arranque diferido del scheduler.
if (!globalAny.__sriSchedulerBooted && process.env.NEXT_RUNTIME === 'nodejs' && process.env.SCHEDULER_ENABLED !== '0') {
  globalAny.__sriSchedulerBooted = true;
  void import('./scheduler/cron').then(({ startScheduler }) => startScheduler()).catch(() => {
    globalAny.__sriSchedulerBooted = false;
  });
}
