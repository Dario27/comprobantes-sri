import { NextRequest, NextResponse } from 'next/server';
import os from 'node:os';
import path from 'node:path';
import { ManualLoginInput } from '@server/validation';
import { openBrowserSession } from '@server/sri/browserSession';
import { browserSessionStore } from '@server/sri/browserSessionStore';
import { boot } from '@server/bootstrap';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const log = childLogger('api:session:login');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ManualLoginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_input', detail: parsed.error.format() }, { status: 400 });
  }

  // Resolver credenciales: por empresa guardada (descifra la clave) o directas.
  let ruc: string;
  let clave: string;
  let cedulaAdicional: string | undefined;
  let companyId = 0;
  let companyNombre: string;

  if ('companyId' in parsed.data) {
    const company = boot.companies.findById(parsed.data.companyId);
    if (!company) return NextResponse.json({ error: 'COMPANY_NOT_FOUND' }, { status: 404 });
    if (company.estado === 'INACTIVO') {
      return NextResponse.json({ error: 'COMPANY_INACTIVE', message: 'La empresa está inactiva' }, { status: 409 });
    }
    try {
      clave = boot.companies.getClave(company.id);
    } catch (err) {
      log.error({ companyId: company.id, err: (err as Error).message }, 'decrypt_failed');
      return NextResponse.json({ error: 'DECRYPT_FAILED', message: (err as Error).message }, { status: 500 });
    }
    ruc = company.ruc;
    companyId = company.id;
    companyNombre = company.nombre;
  } else {
    ruc = parsed.data.ruc;
    clave = parsed.data.clave;
    cedulaAdicional = parsed.data.cedulaAdicional;
    companyNombre = ruc;
  }

  // Carpeta temporal para downloads del browser durante esta sesión.
  const tmpDownloadDir = path.join(os.tmpdir(), `sri-manual-${ruc}-${Date.now()}`);

  try {
    const session = await openBrowserSession({ ruc, clave, cedulaAdicional, downloadPath: tmpDownloadDir });
    const reg = browserSessionStore.register(session, { companyId, companyNombre });
    if (companyId > 0 && boot.companies.findById(companyId)?.estado === 'BLOQUEADA_CAPTCHA') {
      boot.companies.markActive(companyId);
    }
    log.info({ sessionId: reg.sessionId, ruc, companyId }, 'manual_login_ok');
    return NextResponse.json({
      sessionId: reg.sessionId,
      expiresAt: reg.expiresAt.toISOString(),
      ruc,
      companyId,
      companyNombre
    });
  } catch (err) {
    if (err instanceof SriError) {
      if (err.code === 'AUTH_CAPTCHA_REQUIRED' && companyId > 0) {
        boot.companies.markCaptcha(companyId);
      }
      const status = err.code === 'AUTH_INVALID_CREDENTIALS' ? 401
        : err.code === 'AUTH_CAPTCHA_REQUIRED' || err.code === 'AUTH_MFA_REQUIRED' ? 403
        : 502;
      log.warn({ ruc, companyId, code: err.code }, 'manual_login_failed');
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    const message = err instanceof Error ? err.message : 'unknown';
    log.error({ ruc, message }, 'manual_login_unexpected');
    return NextResponse.json({ error: 'AUTH_UNEXPECTED', message }, { status: 500 });
  }
}
