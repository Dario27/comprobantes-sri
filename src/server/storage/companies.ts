import type { DbInstance } from './db';
import { encryptSecret, decryptSecret, type EncryptedSecret } from '../crypto';
import { SriError } from '../errors';

export type CompanyEstado = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADA_CAPTCHA';

export interface Company {
  id: number;
  nombre: string;
  ruc: string;
  estado: CompanyEstado;
  rutaDescarga: string;
  frecuenciaDias: number;
  fechaInicioDescarga: string;
  ultimaEjecucionExitosa: string | null;
  connectionString: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyCreateInput {
  nombre: string;
  ruc: string;
  clave: string;
  estado: CompanyEstado;
  rutaDescarga: string;
  frecuenciaDias: number;
  fechaInicioDescarga: string;
  connectionString?: string;
}

export interface CompanyUpdateInput {
  nombre?: string;
  ruc?: string;
  clave?: string;
  estado?: CompanyEstado;
  rutaDescarga?: string;
  frecuenciaDias?: number;
  fechaInicioDescarga?: string;
  connectionString?: string;
}

interface CompanyRow {
  id: number;
  nombre: string;
  ruc: string;
  clave_cifrada: Buffer;
  clave_iv: Buffer;
  clave_tag: Buffer;
  estado: CompanyEstado;
  ruta_descarga: string;
  frecuencia_dias: number;
  fecha_inicio_descarga: string;
  ultima_ejecucion_exitosa: string | null;
  connection_string: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCompany(r: CompanyRow): Company {
  return {
    id: r.id,
    nombre: r.nombre,
    ruc: r.ruc,
    estado: r.estado,
    rutaDescarga: r.ruta_descarga,
    frecuenciaDias: r.frecuencia_dias,
    fechaInicioDescarga: r.fecha_inicio_descarga,
    ultimaEjecucionExitosa: r.ultima_ejecucion_exitosa,
    connectionString: r.connection_string,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function createCompaniesRepo(db: DbInstance) {
  const raw = db.raw;

  return {
    list(): Company[] {
      const rows = raw.prepare('SELECT * FROM companies ORDER BY nombre ASC').all() as CompanyRow[];
      return rows.map(rowToCompany);
    },

    listByEstado(estado: CompanyEstado): Company[] {
      const rows = raw.prepare('SELECT * FROM companies WHERE estado = ? ORDER BY nombre ASC').all(estado) as CompanyRow[];
      return rows.map(rowToCompany);
    },

    findById(id: number): Company | null {
      const r = raw.prepare('SELECT * FROM companies WHERE id = ?').get(id) as CompanyRow | undefined;
      return r ? rowToCompany(r) : null;
    },

    findByRuc(ruc: string): Company | null {
      const r = raw.prepare('SELECT * FROM companies WHERE ruc = ?').get(ruc) as CompanyRow | undefined;
      return r ? rowToCompany(r) : null;
    },

    getClave(id: number): string {
      const r = raw.prepare('SELECT clave_cifrada, clave_iv, clave_tag FROM companies WHERE id = ?').get(id) as {
        clave_cifrada: Buffer; clave_iv: Buffer; clave_tag: Buffer;
      } | undefined;
      if (!r) throw new SriError('SESSION_NOT_FOUND', `Empresa ${id} no encontrada`);
      const enc: EncryptedSecret = { ciphertext: r.clave_cifrada, iv: r.clave_iv, tag: r.clave_tag };
      return decryptSecret(enc);
    },

    create(input: CompanyCreateInput): Company {
      const enc = encryptSecret(input.clave);
      const now = new Date().toISOString();
      try {
        const result = raw.prepare(`
          INSERT INTO companies (nombre, ruc, clave_cifrada, clave_iv, clave_tag, estado,
            ruta_descarga, frecuencia_dias, fecha_inicio_descarga, connection_string, created_at, updated_at)
          VALUES (@nombre, @ruc, @ciphertext, @iv, @tag, @estado,
            @rutaDescarga, @frecuenciaDias, @fechaInicioDescarga, @connectionString, @now, @now)
        `).run({
          nombre: input.nombre,
          ruc: input.ruc,
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          tag: enc.tag,
          estado: input.estado,
          rutaDescarga: input.rutaDescarga,
          frecuenciaDias: input.frecuenciaDias,
          fechaInicioDescarga: input.fechaInicioDescarga,
          connectionString: input.connectionString ?? null,
          now
        });
        const id = Number(result.lastInsertRowid);
        const found = this.findById(id);
        if (!found) throw new SriError('STORAGE_DB_LOCKED', 'No se pudo recuperar la empresa recién creada');
        return found;
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE')) {
          throw new SriError('LISTING_INVALID_FILTERS', `Ya existe una empresa con RUC ${input.ruc}`);
        }
        throw err;
      }
    },

    update(id: number, input: CompanyUpdateInput): Company {
      const cur = this.findById(id);
      if (!cur) throw new SriError('SESSION_NOT_FOUND', `Empresa ${id} no existe`);

      const sets: string[] = [];
      const params: Record<string, unknown> = { id };

      if (input.nombre !== undefined) { sets.push('nombre = @nombre'); params.nombre = input.nombre; }
      if (input.ruc !== undefined) { sets.push('ruc = @ruc'); params.ruc = input.ruc; }
      if (input.estado !== undefined) { sets.push('estado = @estado'); params.estado = input.estado; }
      if (input.rutaDescarga !== undefined) { sets.push('ruta_descarga = @rutaDescarga'); params.rutaDescarga = input.rutaDescarga; }
      if (input.frecuenciaDias !== undefined) { sets.push('frecuencia_dias = @frecuenciaDias'); params.frecuenciaDias = input.frecuenciaDias; }
      if (input.fechaInicioDescarga !== undefined) { sets.push('fecha_inicio_descarga = @fechaInicioDescarga'); params.fechaInicioDescarga = input.fechaInicioDescarga; }
      if (input.clave) {
        const enc = encryptSecret(input.clave);
        sets.push('clave_cifrada = @ciphertext', 'clave_iv = @iv', 'clave_tag = @tag');
        params.ciphertext = enc.ciphertext;
        params.iv = enc.iv;
        params.tag = enc.tag;
      }
      if (input.connectionString !== undefined) {
        sets.push('connection_string = @connectionString');
        params.connectionString = input.connectionString;
      }
      sets.push('updated_at = @now');
      params.now = new Date().toISOString();

      try {
        raw.prepare(`UPDATE companies SET ${sets.join(', ')} WHERE id = @id`).run(params);
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE')) {
          throw new SriError('LISTING_INVALID_FILTERS', `Ya existe una empresa con ese RUC`);
        }
        throw err;
      }
      const updated = this.findById(id);
      if (!updated) throw new SriError('STORAGE_DB_LOCKED', 'No se pudo recuperar la empresa actualizada');
      return updated;
    },

    delete(id: number): void {
      raw.prepare('DELETE FROM companies WHERE id = ?').run(id);
    },

    markCaptcha(id: number): void {
      raw.prepare(`UPDATE companies SET estado='BLOQUEADA_CAPTCHA', updated_at=? WHERE id=?`)
        .run(new Date().toISOString(), id);
    },

    markActive(id: number): void {
      raw.prepare(`UPDATE companies SET estado='ACTIVO', updated_at=? WHERE id=?`)
        .run(new Date().toISOString(), id);
    },

    setLastSuccess(id: number, isoDateTime: string): void {
      raw.prepare(`UPDATE companies SET ultima_ejecucion_exitosa=?, updated_at=? WHERE id=?`)
        .run(isoDateTime, new Date().toISOString(), id);
    }
  };
}

export type CompaniesRepo = ReturnType<typeof createCompaniesRepo>;
