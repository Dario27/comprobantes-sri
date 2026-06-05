import type { DbInstance } from './db';
import { SriError } from '../errors';

export type UserRol = 'superadmin' | 'admin' | 'user';

export interface Usuario {
  id: number;
  username: string;
  rol: UserRol;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsuarioCreateInput {
  username: string;
  passwordHash: string;
  rol?: UserRol;
  activo?: boolean;
}

export interface UsuarioUpdateInput {
  username?: string;
  passwordHash?: string;
  rol?: UserRol;
  activo?: boolean;
}

interface UsuarioRow {
  id: number;
  username: string;
  password_hash: string;
  rol: UserRol;
  activo: number;
  created_at: string;
  updated_at: string;
}

function rowToUsuario(r: UsuarioRow): Usuario {
  return {
    id: r.id,
    username: r.username,
    rol: r.rol,
    activo: r.activo === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function createUsuariosRepo(db: DbInstance) {
  const raw = db.raw;

  return {
    list(): Usuario[] {
      const rows = raw.prepare(
        'SELECT id,username,rol,activo,created_at,updated_at FROM usuarios ORDER BY username ASC'
      ).all() as UsuarioRow[];
      return rows.map(rowToUsuario);
    },

    findById(id: number): Usuario | null {
      const r = raw.prepare(
        'SELECT id,username,rol,activo,created_at,updated_at FROM usuarios WHERE id = ?'
      ).get(id) as UsuarioRow | undefined;
      return r ? rowToUsuario(r) : null;
    },

    /** Retorna el usuario + hash solo para validación de login. */
    findByUsername(username: string): { usuario: Usuario; passwordHash: string } | null {
      const r = raw.prepare('SELECT * FROM usuarios WHERE username = ?').get(username) as UsuarioRow | undefined;
      if (!r) return null;
      return { usuario: rowToUsuario(r), passwordHash: r.password_hash };
    },

    create(input: UsuarioCreateInput): Usuario {
      const now = new Date().toISOString();
      try {
        const result = raw.prepare(`
          INSERT INTO usuarios (username, password_hash, rol, activo, created_at, updated_at)
          VALUES (@username, @passwordHash, @rol, @activo, @now, @now)
        `).run({
          username: input.username,
          passwordHash: input.passwordHash,
          rol: input.rol ?? 'user',
          activo: (input.activo ?? true) ? 1 : 0,
          now
        });
        const id = Number(result.lastInsertRowid);
        const found = this.findById(id);
        if (!found) throw new SriError('STORAGE_DB_LOCKED', 'No se pudo recuperar el usuario recién creado');
        return found;
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE')) {
          throw new SriError('USER_DUPLICATE', `Ya existe un usuario con el nombre "${input.username}"`);
        }
        throw err;
      }
    },

    update(id: number, input: UsuarioUpdateInput): Usuario {
      const cur = this.findById(id);
      if (!cur) throw new SriError('USER_NOT_FOUND', `Usuario ${id} no existe`);

      const sets: string[] = [];
      const params: Record<string, unknown> = { id };

      if (input.username !== undefined) { sets.push('username = @username'); params.username = input.username; }
      if (input.passwordHash !== undefined) { sets.push('password_hash = @passwordHash'); params.passwordHash = input.passwordHash; }
      if (input.rol !== undefined) { sets.push('rol = @rol'); params.rol = input.rol; }
      if (input.activo !== undefined) { sets.push('activo = @activo'); params.activo = input.activo ? 1 : 0; }

      if (sets.length === 0) return cur;

      sets.push('updated_at = @now');
      params.now = new Date().toISOString();

      try {
        raw.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = @id`).run(params);
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE')) {
          throw new SriError('USER_DUPLICATE', 'Ya existe un usuario con ese nombre');
        }
        throw err;
      }

      const updated = this.findById(id);
      if (!updated) throw new SriError('STORAGE_DB_LOCKED', 'No se pudo recuperar el usuario actualizado');
      return updated;
    },

    delete(id: number): void {
      raw.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    }
  };
}

export type UsuariosRepo = ReturnType<typeof createUsuariosRepo>;
