import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SESSION_OPTIONS, type SessionData } from './src/server/portalSession';

// Rutas que solo puede acceder superadmin
const SUPERADMIN_ROUTES = ['/usuarios'];
// Rutas que requieren admin o superadmin (user solo ve dashboard + ejecuciones)
const ADMIN_ROUTES = ['/empresas', '/descarga', '/auditoria'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(req, res, SESSION_OPTIONS);

  const { pathname } = req.nextUrl;

  // Sin sesión → redirigir a login
  if (!session.userId) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  const rol = session.rol;

  // Verificar rutas que requieren superadmin
  if (SUPERADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (rol !== 'superadmin') {
      const dashUrl = req.nextUrl.clone();
      dashUrl.pathname = '/dashboard';
      dashUrl.searchParams.set('forbidden', '1');
      return NextResponse.redirect(dashUrl);
    }
  }

  // Verificar rutas que requieren admin o superadmin
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (rol !== 'admin' && rol !== 'superadmin') {
      const dashUrl = req.nextUrl.clone();
      dashUrl.pathname = '/dashboard';
      dashUrl.searchParams.set('forbidden', '1');
      return NextResponse.redirect(dashUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!login|api/auth|api/session|_next/static|_next/image|favicon.ico).*)'
  ]
};
