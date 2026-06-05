import { getIronSession } from 'iron-session';
import type { SessionOptions } from 'iron-session';
import type { NextRequest, NextResponse } from 'next/server';
import type { UserRol } from './storage/usuarios';

export interface SessionData {
  userId: number;
  username: string;
  rol: UserRol;
}

const sessionPassword = process.env.SESSION_PASSWORD;
console.log("session password=> ", sessionPassword)
if (!sessionPassword && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_PASSWORD no configurado. Requerido en producción para firmar cookies de sesión.');
}

export const SESSION_OPTIONS: SessionOptions = {
  cookieName: 'gt_session',
  password: sessionPassword ?? 'fallback-dev-password-change-in-production-32c',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 8  // 8 horas
  }
};

export function getPortalSession(req: NextRequest, res: NextResponse) {
  return getIronSession<SessionData>(req, res, SESSION_OPTIONS);
}
