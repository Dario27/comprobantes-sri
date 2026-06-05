import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { boot } from '@server/bootstrap';
import { UserUpdateBody } from '@server/validation';
import { getPortalSession } from '@server/portalSession';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = childLogger('api:admin:usuarios:id');

function parseId(idStr: string): number | null {
  const n = Number(idStr);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function requireSuperadmin(req: NextRequest, res: NextResponse) {
  const session = await getPortalSession(req, res);
  if (!session.userId || session.rol !== 'superadmin') return null;
  return session;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const res = NextResponse.json({});
  const session = await requireSuperadmin(req, res);
  if (!session) return NextResponse.json({ error: 'PORTAL_UNAUTHORIZED' }, { status: 403 });
  const u = boot.usuarios.findById(id);
  if (!u) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ usuario: u });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const res = NextResponse.json({});
  const session = await requireSuperadmin(req, res);
  if (!session) return NextResponse.json({ error: 'PORTAL_UNAUTHORIZED' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = UserUpdateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_input', detail: parsed.error.format() }, { status: 400 });
  }

  try {
    const updateInput: Parameters<typeof boot.usuarios.update>[1] = {};
    if (parsed.data.username !== undefined) updateInput.username = parsed.data.username;
    if (parsed.data.rol !== undefined) updateInput.rol = parsed.data.rol;
    if (parsed.data.activo !== undefined) updateInput.activo = parsed.data.activo;
    if (parsed.data.password) {
      updateInput.passwordHash = await bcryptjs.hash(parsed.data.password, 12);
    }
    const updated = boot.usuarios.update(id, updateInput);
    log.info({ id, updatedBy: session.username }, 'usuario_updated');
    return NextResponse.json({ usuario: updated });
  } catch (err) {
    if (err instanceof SriError) {
      const status = err.code === 'USER_NOT_FOUND' ? 404 : err.code === 'USER_DUPLICATE' ? 409 : 500;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    log.error({ err: (err as Error).message }, 'usuario_update_unexpected');
    return NextResponse.json({ error: 'server_error', message: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const res = NextResponse.json({});
  const session = await requireSuperadmin(req, res);
  if (!session) return NextResponse.json({ error: 'PORTAL_UNAUTHORIZED' }, { status: 403 });

  // No se puede eliminar el propio usuario.
  if (session.userId === id) {
    return NextResponse.json({ error: 'bad_input', message: 'No puedes eliminar tu propio usuario.' }, { status: 400 });
  }

  const exists = boot.usuarios.findById(id);
  if (!exists) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  boot.usuarios.delete(id);
  log.info({ id, deletedBy: session.username }, 'usuario_deleted');
  return NextResponse.json({ ok: true });
}
