import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { LogsRepo, LogLevel } from './storage/logs';

const logsDir = path.resolve(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
} catch { /* read-only build env */ }

const level = process.env.LOG_LEVEL ?? 'info';

// Nivel numérico de pino → etiqueta
function pinoLevelToLabel(numericLevel: number): LogLevel {
  if (numericLevel <= 10) return 'trace';
  if (numericLevel <= 20) return 'debug';
  if (numericLevel <= 30) return 'info';
  if (numericLevel <= 40) return 'warn';
  if (numericLevel <= 50) return 'error';
  return 'fatal';
}

// Referencia lazy al repo de logs (disponible tras inicializar boot).
function getLogsRepo(): LogsRepo | null {
  const g = globalThis as unknown as { __sriBoot?: { logs?: LogsRepo } };
  return g.__sriBoot?.logs ?? null;
}

// Stream writable que persiste cada línea JSON de pino en SQLite.
const sqliteStream = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    try {
      const parsed = JSON.parse(chunk.toString()) as {
        time?: number; level?: number; scope?: string; msg?: string;
        pid?: number; hostname?: string; [k: string]: unknown;
      };
      const repo = getLogsRepo();
      if (repo && parsed.msg !== undefined) {
        const { time: _t, level: _l, scope, msg, pid: _p, hostname: _h, ...rest } = parsed;
        const metadata = Object.keys(rest).length > 0 ? JSON.stringify(rest) : null;
        repo.insert({
          timestamp: parsed.time ? new Date(parsed.time).toISOString() : new Date().toISOString(),
          level: pinoLevelToLabel(parsed.level ?? 30),
          modulo: scope ?? null,
          mensaje: msg ?? '',
          metadata,
        });
      }
    } catch { /* ignorar errores de parse */ }
    callback();
  }
});

function buildLogger(): pino.Logger {
  if (process.env.NODE_ENV === 'test') return pino({ level: 'silent' });

  try {
    const streams: pino.StreamEntry[] = [
      { level: level as pino.Level, stream: pino.destination({ dest: path.join(logsDir, 'app.log'), sync: false, mkdir: true }) },
      { level: 'warn', stream: pino.destination({ dest: path.join(logsDir, 'errors.log'), sync: false, mkdir: true }) },
      { level: level as pino.Level, stream: sqliteStream },
    ];
    if (process.env.NODE_ENV !== 'production') {
      streams.push({ level: level as pino.Level, stream: pino.destination({ dest: 1, sync: false }) });
    }
    return pino({ level }, pino.multistream(streams));
  } catch {
    return pino({ level });
  }
}

export const logger = buildLogger();

export function childLogger(scope: string, extra: Record<string, unknown> = {}) {
  return logger.child({ scope, ...extra });
}
