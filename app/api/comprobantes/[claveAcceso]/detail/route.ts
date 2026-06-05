import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { boot } from '@server/bootstrap';
import { browserSessionStore } from '@server/sri/browserSessionStore';
import { buildComprobanteDetail } from '@server/sri/comprobanteDetail';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = childLogger('api:comprobantes:detail');

const ClaveSchema = z.string().regex(/^\d{49}$/);

const ERROR_HTTP: Record<string, number> = {
  COMPROBANTE_NOT_FOUND: 404,
  FORBIDDEN_COMPANY: 403,
  XML_PARSE_FAILED: 422,
  XML_MISSING: 500
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ claveAcceso: string }> }) {
  const { claveAcceso } = await params;
  const claveParse = ClaveSchema.safeParse(claveAcceso);
  if (!claveParse.success) {
    return NextResponse.json({ error: 'INVALID_CLAVE', message: 'Clave de acceso inválida.' }, { status: 400 });
  }

  // sessionId opcional: con sesión SRI válida se respeta el scope por empresa; sin ella
  // (bandeja del usuario final) se lee el comprobante por su clave de acceso.
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const entry = sessionId ? browserSessionStore.get(sessionId) : null;
  const companyId = entry ? entry.companyId : null;

  try {
    const detail = buildComprobanteDetail(boot.db, { companyId }, claveParse.data);
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof SriError) {
      const status = ERROR_HTTP[err.code] ?? 500;
      log.warn({ claveAcceso: claveParse.data, companyId, code: err.code }, 'detail_error');
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    log.error({ claveAcceso: claveParse.data, err: (err as Error).message }, 'detail_unexpected');
    return NextResponse.json({ error: 'INTERNAL', message: 'Error interno al obtener el detalle.' }, { status: 500 });
  }
}
