import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { SriError } from '../errors';
import { childLogger } from '../logging';

const log = childLogger('storage:db');

// Fase 2: persistencia de comprobantes (XML en BLOB) y jobs.
// La columna `company_id` se conserva (default 0) para que la capa de empresas de la
// Fase 3 encaje sin migración de esquema. Las tablas `companies` y `job_runs` se añadirán
// en la Fase 3 (ver sri-descargas: storage/companies.ts, storage/jobRuns.ts).

export interface ComprobanteRecord {
  claveAcceso: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  tipo: string;
  numeroAutorizacion: string;
  fechaEmision: string;
  fechaAutorizacion: string;
  montoTotal: number;
  xmlPath: string | null;
  ridePath?: string | null;
  xmlContent?: Buffer | null;
  downloadedAt: string;
  status: 'ok' | 'xml_only' | 'failed';
  companyId: number;
}

export interface JobRecord {
  id: string;
  filtersJson: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  done: number;
  failed: number;
  startedAt: string;
  finishedAt?: string | null;
  error?: string | null;
  companyId: number;
}

export interface HistoryFilters {
  desde?: string;
  hasta?: string;
  ruc?: string;
  tipo?: string;
  companyId?: number;
}

// DDL de comprobantes con FK a companies (para la migración programática).
const COMPROBANTES_DDL = `
CREATE TABLE IF NOT EXISTS comprobantes (
  clave_acceso TEXT PRIMARY KEY,
  ruc_emisor TEXT NOT NULL,
  razon_social_emisor TEXT,
  tipo TEXT NOT NULL,
  numero_autorizacion TEXT,
  fecha_emision TEXT NOT NULL,
  fecha_autorizacion TEXT,
  monto_total REAL,
  xml_path TEXT,
  ride_path TEXT,
  xml_content BLOB,
  downloaded_at TEXT NOT NULL,
  status TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fecha ON comprobantes(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_ruc ON comprobantes(ruc_emisor);
`;

// companies se declara antes de comprobantes para que la referencia FK sea válida.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  ruc TEXT NOT NULL UNIQUE,
  clave_cifrada BLOB NOT NULL,
  clave_iv BLOB NOT NULL,
  clave_tag BLOB NOT NULL,
  estado TEXT NOT NULL,
  ruta_descarga TEXT NOT NULL,
  frecuencia_dias INTEGER NOT NULL,
  fecha_inicio_descarga TEXT NOT NULL,
  ultima_ejecucion_exitosa TEXT,
  connection_string TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_estado ON companies(estado);

${COMPROBANTES_DDL}

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  filters_json TEXT NOT NULL,
  status TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT,
  company_id INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  modo TEXT NOT NULL,
  estado TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  rango_desde TEXT,
  rango_hasta TEXT,
  comprobantes_descargados INTEGER NOT NULL DEFAULT 0,
  comprobantes_fallidos INTEGER NOT NULL DEFAULT 0,
  error_mensaje TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobruns_company ON job_runs(company_id, started_at);
CREATE INDEX IF NOT EXISTS idx_jobruns_estado ON job_runs(estado);
CREATE INDEX IF NOT EXISTS idx_jobruns_started ON job_runs(started_at);

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'user'
                CHECK(rol IN ('superadmin','admin','user')),
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);

CREATE TABLE IF NOT EXISTS logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  level     TEXT NOT NULL,
  modulo    TEXT,
  mensaje   TEXT NOT NULL,
  metadata  TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
`;

interface ComprobanteRow {
  clave_acceso: string;
  ruc_emisor: string;
  razon_social_emisor: string;
  tipo: string;
  numero_autorizacion: string;
  fecha_emision: string;
  fecha_autorizacion: string;
  monto_total: number;
  xml_path: string | null;
  ride_path: string | null;
  xml_content: Buffer | null;
  downloaded_at: string;
  status: ComprobanteRecord['status'];
  company_id: number;
}

interface JobRow {
  id: string;
  filters_json: string;
  status: JobRecord['status'];
  total: number;
  done: number;
  failed: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  company_id: number;
}

function rowToComprobante(r: ComprobanteRow): ComprobanteRecord {
  return {
    claveAcceso: r.clave_acceso,
    rucEmisor: r.ruc_emisor,
    razonSocialEmisor: r.razon_social_emisor,
    tipo: r.tipo,
    numeroAutorizacion: r.numero_autorizacion,
    fechaEmision: r.fecha_emision,
    fechaAutorizacion: r.fecha_autorizacion,
    montoTotal: r.monto_total,
    xmlPath: r.xml_path,
    ridePath: r.ride_path,
    xmlContent: r.xml_content,
    downloadedAt: r.downloaded_at,
    status: r.status,
    companyId: r.company_id
  };
}

function rowToJob(r: JobRow): JobRecord {
  return {
    id: r.id, filtersJson: r.filters_json, status: r.status,
    total: r.total, done: r.done, failed: r.failed,
    startedAt: r.started_at, finishedAt: r.finished_at, error: r.error,
    companyId: r.company_id
  };
}

export function createDb(filePath: string) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  // ── Migración: añadir connection_string a companies si no existe ────────────
  // ALTER TABLE ADD COLUMN es seguro para columnas nullable en SQLite.
  {
    type ColRow = { name: string };
    const cols = (db.pragma('table_info(companies)') as ColRow[]).map((r) => r.name);
    if (!cols.includes('connection_string')) {
      log.info('migrating companies: adding connection_string column');
      db.exec(`ALTER TABLE companies ADD COLUMN connection_string TEXT;`);
    }
  }

  // ── Migración: añadir FK company_id → companies en tabla comprobantes ──────
  // SQLite no soporta ALTER TABLE ADD CONSTRAINT; hay que recrear la tabla.
  // Se detecta si la FK ya existe usando PRAGMA foreign_key_list; si no está,
  // se copia la tabla descartando filas huérfanas (company_id sin empresa real).
  {
    type FkRow = { table: string };
    const fkList = db.pragma('foreign_key_list(comprobantes)') as FkRow[];
    const hasCompanyFk = fkList.some((r) => r.table === 'companies');

    if (!hasCompanyFk) {
      log.info('migrating comprobantes table to add FK company_id -> companies');
      db.pragma('foreign_keys = OFF');
      try { db.transaction(() => {
        // Contar filas huérfanas que no tienen empresa real (serán descartadas).
        const { orphans } = db.prepare(
          `SELECT COUNT(*) AS orphans FROM comprobantes WHERE company_id NOT IN (SELECT id FROM companies)`
        ).get() as { orphans: number };

        if (orphans > 0) {
          log.warn({ orphans }, 'dropping orphan comprobantes without valid company (legacy company_id=0)');
        }

        // Crear tabla nueva con FK.
        db.exec(`
          CREATE TABLE comprobantes_new (
            clave_acceso TEXT PRIMARY KEY,
            ruc_emisor TEXT NOT NULL,
            razon_social_emisor TEXT,
            tipo TEXT NOT NULL,
            numero_autorizacion TEXT,
            fecha_emision TEXT NOT NULL,
            fecha_autorizacion TEXT,
            monto_total REAL,
            xml_path TEXT,
            ride_path TEXT,
            xml_content BLOB,
            downloaded_at TEXT NOT NULL,
            status TEXT NOT NULL,
            company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE
          );
        `);

        // Copiar solo filas con empresa válida.
        db.exec(`
          INSERT INTO comprobantes_new
            SELECT clave_acceso, ruc_emisor, razon_social_emisor, tipo, numero_autorizacion,
                   fecha_emision, fecha_autorizacion, monto_total, xml_path, ride_path,
                   xml_content, downloaded_at, status, company_id
            FROM comprobantes
            WHERE company_id IN (SELECT id FROM companies);
        `);

        db.exec(`DROP TABLE comprobantes;`);
        db.exec(`ALTER TABLE comprobantes_new RENAME TO comprobantes;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_fecha ON comprobantes(fecha_emision);`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_ruc ON comprobantes(ruc_emisor);`);

        log.info({ orphans }, 'comprobantes migration complete');
      })(); } finally { db.pragma('foreign_keys = ON'); }
    }
  }

  // Reaper de job_runs huérfanos (proceso interrumpido entre arranques).
  db.prepare(`
    UPDATE job_runs SET estado='FALLO', ended_at=@now, error_mensaje='proceso interrumpido'
    WHERE estado='EN_CURSO'
  `).run({ now: new Date().toISOString() });

  const upsertStmt = db.prepare(`
    INSERT INTO comprobantes (clave_acceso, ruc_emisor, razon_social_emisor, tipo, numero_autorizacion,
      fecha_emision, fecha_autorizacion, monto_total, xml_path, ride_path, xml_content, downloaded_at, status, company_id)
    VALUES (@claveAcceso, @rucEmisor, @razonSocialEmisor, @tipo, @numeroAutorizacion,
      @fechaEmision, @fechaAutorizacion, @montoTotal, @xmlPath, @ridePath, @xmlContent, @downloadedAt, @status, @companyId)
    ON CONFLICT(clave_acceso) DO UPDATE SET
      ruc_emisor=excluded.ruc_emisor,
      razon_social_emisor=excluded.razon_social_emisor,
      tipo=excluded.tipo,
      numero_autorizacion=excluded.numero_autorizacion,
      fecha_emision=excluded.fecha_emision,
      fecha_autorizacion=excluded.fecha_autorizacion,
      monto_total=excluded.monto_total,
      xml_path=excluded.xml_path,
      ride_path=excluded.ride_path,
      xml_content=excluded.xml_content,
      downloaded_at=excluded.downloaded_at,
      status=excluded.status,
      company_id=excluded.company_id
  `);

  const findStmt = db.prepare('SELECT * FROM comprobantes WHERE clave_acceso = ?');

  const createJobStmt = db.prepare(`
    INSERT INTO jobs (id, filters_json, status, total, done, failed, started_at, finished_at, error, company_id)
    VALUES (@id, @filtersJson, @status, @total, @done, @failed, @startedAt, @finishedAt, @error, @companyId)
  `);
  const getJobStmt = db.prepare('SELECT * FROM jobs WHERE id = ?');

  const api = {
    raw: db,

    upsertComprobante(rec: ComprobanteRecord) {
      try {
        upsertStmt.run({
          ...rec,
          xmlPath: rec.xmlPath ?? null,
          ridePath: rec.ridePath ?? null,
          xmlContent: rec.xmlContent ?? null
        });
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code === 'SQLITE_BUSY') throw new SriError('STORAGE_DB_LOCKED', 'BD bloqueada', err);
        throw err;
      }
    },

    findByClaveAcceso(clave: string): ComprobanteRecord | null {
      const r = findStmt.get(clave) as ComprobanteRow | undefined;
      return r ? rowToComprobante(r) : null;
    },

    findDetailForSession(clave: string, companyId: number): ComprobanteRecord | null {
      const r = findStmt.get(clave) as ComprobanteRow | undefined;
      if (!r) return null;
      if (r.company_id !== companyId) {
        throw new SriError('FORBIDDEN_COMPANY', 'No tienes permisos para ver este comprobante.');
      }
      return rowToComprobante(r);
    },

    findAlreadyDownloaded(claves: string[], companyId: number): string[] {
      if (claves.length === 0) return [];
      const placeholders = claves.map(() => '?').join(',');
      const rows = db
        .prepare(`SELECT clave_acceso FROM comprobantes WHERE company_id = ? AND clave_acceso IN (${placeholders})`)
        .all(companyId, ...claves) as { clave_acceso: string }[];
      return rows.map(r => r.clave_acceso);
    },

    listHistory(f: HistoryFilters): ComprobanteRecord[] {
      const where: string[] = [];
      const params: unknown[] = [];
      if (f.companyId !== undefined) { where.push('company_id = ?'); params.push(f.companyId); }
      if (f.desde) { where.push('fecha_emision >= ?'); params.push(f.desde); }
      if (f.hasta) { where.push('fecha_emision <= ?'); params.push(f.hasta); }
      if (f.ruc)   { where.push('ruc_emisor = ?'); params.push(f.ruc); }
      if (f.tipo)  { where.push('tipo = ?'); params.push(f.tipo); }
      const sql = `SELECT clave_acceso, ruc_emisor, razon_social_emisor, tipo, numero_autorizacion,
                          fecha_emision, fecha_autorizacion, monto_total, xml_path, ride_path,
                          downloaded_at, status, company_id
                   FROM comprobantes ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY fecha_emision DESC`;
      const rows = db.prepare(sql).all(...params) as Omit<ComprobanteRow, 'xml_content'>[];
      return rows.map((r) => rowToComprobante({ ...r, xml_content: null }));
    },

    createJob(rec: JobRecord) {
      createJobStmt.run({ ...rec, finishedAt: rec.finishedAt ?? null, error: rec.error ?? null });
    },

    getJob(id: string): JobRecord | null {
      const r = getJobStmt.get(id) as JobRow | undefined;
      return r ? rowToJob(r) : null;
    },

    updateJob(id: string, patch: Partial<JobRecord>) {
      const cur = api.getJob(id);
      if (!cur) return;
      const next = { ...cur, ...patch };
      db.prepare(`UPDATE jobs SET status=@status, total=@total, done=@done, failed=@failed,
                  finished_at=@finishedAt, error=@error WHERE id=@id`).run({
        id, status: next.status, total: next.total, done: next.done, failed: next.failed,
        finishedAt: next.finishedAt ?? null, error: next.error ?? null
      });
    }
  };

  return api;
}

export type DbInstance = ReturnType<typeof createDb>;
