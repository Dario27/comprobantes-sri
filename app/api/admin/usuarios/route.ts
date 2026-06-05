import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { boot } from '@server/bootstrap';
import { UserCreateBody } from '@server/validation';
import { getPortalSession } from '@server/portalSession';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = childLogger('api:admin:usuarios');

async function requireSuperadmin(req: NextRequest, res: NextResponse) {
  const session = await getPortalSession(req, res);
  if (!session.userId || session.rol !== 'superadmin') {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  const res = NextResponse.json({});
  const session = await requireSuperadmin(req, res);
  if (!session) return NextResponse.json({ error: 'PORTAL_UNAUTHORIZED', message: 'Requiere rol superadmin' }, { status: 403 });
  const items = boot.usuarios.list();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({});
  const session = await requireSuperadmin(req, res);
  if (!session) return NextResponse.json({ error: 'PORTAL_UNAUTHORIZED', message: 'Requiere rol superadmin' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = UserCreateBody.safeParse(body);
  if (!parsed.success) {
    const fmt = parsed.error.format();
    const fieldErrors = Object.entries(fmt)
      .filter(([k]) => k !== '_errors')
      .flatMap(([k, v]) => ((v as { _errors: string[] })._errors ?? []).map((e) => `${k}: ${e}`));
    const message = fieldErrors.length ? fieldErrors.join(' | ') : 'Datos inválidos';
    return NextResponse.json({ error: 'bad_input', message, detail: fmt }, { status: 400 });
  }

  try {
    const passwordHash = await bcryptjs.hash(parsed.data.password, 12);
    const created = boot.usuarios.create({
      username: parsed.data.username,
      passwordHash,
      rol: parsed.data.rol,
      activo: parsed.data.activo
    });
    log.info({ username: created.username, rol: created.rol, createdBy: session.username }, 'usuario_created');
    return NextResponse.json({ usuario: created }, { status: 201 });
  } catch (err) {
    if (err instanceof SriError) {
      const status = err.code === 'USER_DUPLICATE' ? 409 : 500;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    log.error({ err: (err as Error).message }, 'usuario_create_unexpected');
    return NextResponse.json({ error: 'server_error', message: (err as Error).message }, { status: 500 });
  }
}
