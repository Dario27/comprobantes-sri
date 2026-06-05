import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { boot } from '@server/bootstrap';
import { LoginBody } from '@server/validation';
import { getPortalSession } from '@server/portalSession';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = childLogger('api:auth:login');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_input', message: 'Usuario y contraseña requeridos' }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const entry = boot.usuarios.findByUsername(username);

  if (!entry || !entry.usuario.activo) {
    log.warn({ username }, 'login_failed_user_not_found_or_inactive');
    return NextResponse.json({ error: 'AUTH_INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }

  const valid = await bcryptjs.compare(password, entry.passwordHash);
  if (!valid) {
    log.warn({ username }, 'login_failed_wrong_password');
    return NextResponse.json({ error: 'AUTH_INVALID_CREDENTIALS', message: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }

  const res = NextResponse.json({ user: { username: entry.usuario.username, rol: entry.usuario.rol } });
  const session = await getPortalSession(req, res);
  session.userId = entry.usuario.id;
  session.username = entry.usuario.username;
  session.rol = entry.usuario.rol;
  await session.save();

  log.info({ username, rol: entry.usuario.rol }, 'login_ok');
  return res;
}
