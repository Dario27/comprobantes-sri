import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@server/bootstrap';
import { CompanyCreateBody } from '@server/validation';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';
import { syncEmpresaToExternalApi } from '@server/integrations/empresasApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = childLogger('api:admin:companies');

export async function GET() {
  const items = boot.companies.list();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CompanyCreateBody.safeParse(body);
  if (!parsed.success) {
    const fmt = parsed.error.format();
    const fieldErrors = Object.entries(fmt)
      .filter(([k]) => k !== '_errors')
      .flatMap(([k, v]) => ((v as { _errors: string[] })._errors ?? []).map((e) => `${k}: ${e}`));
    const message = fieldErrors.length ? fieldErrors.join(' | ') : 'Datos inválidos';
    return NextResponse.json({ error: 'bad_input', message, detail: fmt }, { status: 400 });
  }
  try {
    const created = boot.companies.create(parsed.data);
    // Sync best-effort a la API externa de empresas (multi-tenant).
    // No lanza: si falla, la empresa queda creada local y se loguea un warn.
    await syncEmpresaToExternalApi({
      id: created.id,
      nombre: created.nombre,
      connectionString: parsed.data.connectionString,
      activo: created.estado === 'ACTIVO',
    });
    return NextResponse.json({ company: created }, { status: 201 });
  } catch (err) {
    if (err instanceof SriError) {
      log.warn({ code: err.code, msg: err.message }, 'company_create_failed');
      const status = err.code === 'LISTING_INVALID_FILTERS' ? 409
        : err.code === 'STORAGE_PERMISSION' ? 500 : 500;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    log.error({ err: (err as Error).message }, 'company_create_unexpected');
    return NextResponse.json({ error: 'server_error', message: (err as Error).message }, { status: 500 });
  }
}
