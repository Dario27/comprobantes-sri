import type { DbInstance } from './db';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  modulo: string | null;
  mensaje: string;
  metadata: string | null;
}

export interface LogInsertInput {
  timestamp: string;
  level: LogLevel;
  modulo?: string | null;
  mensaje: string;
  metadata?: string | null;
}

export interface LogFilters {
  level?: LogLevel;
  modulo?: string;
  from?: string;
  to?: string;
  limit?: number;
}

interface LogRow {
  id: number;
  timestamp: string;
  level: LogLevel;
  modulo: string | null;
  mensaje: string;
  metadata: string | null;
}

export function createLogsRepo(db: DbInstance) {
  const raw = db.raw;

  const insertStmt = raw.prepare(
    `INSERT INTO logs (timestamp, level, modulo, mensaje, metadata)
     VALUES (@timestamp, @level, @modulo, @mensaje, @metadata)`
  );

  return {
    insert(input: LogInsertInput): void {
      try {
        insertStmt.run({
          timestamp: input.timestamp,
          level: input.level,
          modulo: input.modulo ?? null,
          mensaje: input.mensaje,
          metadata: input.metadata ?? null,
        });
      } catch (err) {
        // No lanzar para no interrumpir la request, pero emitir a stderr para no perder la señal
        process.stderr.write(`[logs:insert] SQLite error: ${(err as Error).message}\n`);
      }
    },

    query(f: LogFilters = {}): LogEntry[] {
      const where: string[] = [];
      const params: unknown[] = [];
      if (f.level)  { where.push('level = ?');      params.push(f.level); }
      if (f.modulo) { where.push('modulo = ?');     params.push(f.modulo); }
      if (f.from)   { where.push('timestamp >= ?'); params.push(f.from); }
      if (f.to)     { where.push('timestamp <= ?'); params.push(f.to + 'T23:59:59'); }
      const limit = f.limit ?? 500;
      const sql = `SELECT * FROM logs
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY timestamp DESC
                   LIMIT ${limit}`;
      return raw.prepare(sql).all(...params) as LogRow[];
    },

    modulosList(): string[] {
      const rows = raw.prepare(
        `SELECT DISTINCT modulo FROM logs WHERE modulo IS NOT NULL ORDER BY modulo ASC`
      ).all() as { modulo: string }[];
      return rows.map(r => r.modulo);
    }
  };
}

export type LogsRepo = ReturnType<typeof createLogsRepo>;
