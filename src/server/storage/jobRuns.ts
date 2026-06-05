import type { DbInstance } from './db';

export type JobRunEstado = 'EN_CURSO' | 'EXITO' | 'FALLO' | 'CAPTCHA';
export type JobRunModo = 'AUTOMATICO' | 'MANUAL';

export interface JobRun {
  id: number;
  companyId: number;
  modo: JobRunModo;
  estado: JobRunEstado;
  startedAt: string;
  endedAt: string | null;
  rangoDesde: string | null;
  rangoHasta: string | null;
  comprobantesDescargados: number;
  comprobantesFallidos: number;
  errorMensaje: string | null;
}

export interface JobRunWithCompany extends JobRun {
  companyNombre: string;
}

export interface JobRunFilters {
  companyId?: number;
  estado?: JobRunEstado;
  from?: string;
  to?: string;
  limit?: number;
}

interface JobRunRow {
  id: number;
  company_id: number;
  modo: JobRunModo;
  estado: JobRunEstado;
  started_at: string;
  ended_at: string | null;
  rango_desde: string | null;
  rango_hasta: string | null;
  comprobantes_descargados: number;
  comprobantes_fallidos: number;
  error_mensaje: string | null;
}

interface JoinedRow extends JobRunRow {
  company_nombre: string;
}

function rowToJobRun(r: JobRunRow): JobRun {
  return {
    id: r.id,
    companyId: r.company_id,
    modo: r.modo,
    estado: r.estado,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    rangoDesde: r.rango_desde,
    rangoHasta: r.rango_hasta,
    comprobantesDescargados: r.comprobantes_descargados,
    comprobantesFallidos: r.comprobantes_fallidos,
    errorMensaje: r.error_mensaje
  };
}

export function createJobRunsRepo(db: DbInstance) {
  const raw = db.raw;

  return {
    create(input: {
      companyId: number;
      modo: JobRunModo;
      rangoDesde: string;
      rangoHasta: string;
    }): number {
      const now = new Date().toISOString();
      const result = raw.prepare(`
        INSERT INTO job_runs (company_id, modo, estado, started_at, rango_desde, rango_hasta,
          comprobantes_descargados, comprobantes_fallidos)
        VALUES (@companyId, @modo, 'EN_CURSO', @now, @rangoDesde, @rangoHasta, 0, 0)
      `).run({
        companyId: input.companyId,
        modo: input.modo,
        now,
        rangoDesde: input.rangoDesde,
        rangoHasta: input.rangoHasta
      });
      return Number(result.lastInsertRowid);
    },

    finish(id: number, estado: JobRunEstado, opts: {
      comprobantesDescargados?: number;
      comprobantesFallidos?: number;
      errorMensaje?: string | null;
    } = {}): void {
      raw.prepare(`
        UPDATE job_runs SET
          estado = @estado,
          ended_at = @endedAt,
          comprobantes_descargados = @ok,
          comprobantes_fallidos = @failed,
          error_mensaje = @err
        WHERE id = @id
      `).run({
        id,
        estado,
        endedAt: new Date().toISOString(),
        ok: opts.comprobantesDescargados ?? 0,
        failed: opts.comprobantesFallidos ?? 0,
        err: opts.errorMensaje ?? null
      });
    },

    list(f: JobRunFilters = {}): JobRunWithCompany[] {
      const where: string[] = [];
      const params: unknown[] = [];
      if (f.companyId !== undefined) { where.push('jr.company_id = ?'); params.push(f.companyId); }
      if (f.estado) { where.push('jr.estado = ?'); params.push(f.estado); }
      if (f.from) { where.push('jr.started_at >= ?'); params.push(f.from); }
      if (f.to) { where.push('jr.started_at <= ?'); params.push(f.to); }
      const limit = f.limit ?? 500;
      const sql = `
        SELECT jr.*, c.nombre AS company_nombre
        FROM job_runs jr
        LEFT JOIN companies c ON c.id = jr.company_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY jr.started_at DESC
        LIMIT ${limit}
      `;
      const rows = raw.prepare(sql).all(...params) as JoinedRow[];
      return rows.map(r => ({ ...rowToJobRun(r), companyNombre: r.company_nombre ?? '(eliminada)' }));
    },

    findById(id: number): JobRun | null {
      const r = raw.prepare('SELECT * FROM job_runs WHERE id = ?').get(id) as JobRunRow | undefined;
      return r ? rowToJobRun(r) : null;
    }
  };
}

export type JobRunsRepo = ReturnType<typeof createJobRunsRepo>;
