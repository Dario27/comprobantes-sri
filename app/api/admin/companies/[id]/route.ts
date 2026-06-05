import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@server/bootstrap';
import { CompanyUpdateBody } from '@server/validation';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';
import { syncEmpresaToExternalApi } from '@server/integrations/empresasApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = childLogger('api:admin:companies:id');

function parseId(idStr: string): number | null {
  const n = Number(idStr);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const c = boot.companies.findById(id);
  if (!c) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ company: c });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  const body = await req.json().catch(() => null);
  const parsed = CompanyUpdateBody.safeParse(body);
  if (!parsed.success) {
    const fmt = parsed.error.format();
    const fieldErrors = Object.entries(fmt)
      .filter(([k]) => k !== '_errors')
      .flatMap(([k, v]) => ((v as { _errors: string[] })._errors ?? []).map((e) => `${k}: ${e}`));
    const message = fieldErrors.length ? fieldErrors.join(' | ') : 'Datos inválidos';
    return NextResponse.json({ error: 'bad_input', message, detail: fmt }, { status: 400 });
  }
  try {
    const updated = boot.companies.update(id, parsed.data);
    // Re-sync a la API externa si se actualizó la connectionString (best-effort).
    if (parsed.data.connectionString !== undefined && updated.connectionString) {
      await syncEmpresaToExternalApi({
        id: updated.id,
        nombre: updated.nombre,
        connectionString: updated.connectionString,
        activo: updated.estado === 'ACTIVO',
      }, 'PUT');
    }
    return NextResponse.json({ company: updated });
  } catch (err) {
    if (err instanceof SriError) {
      const status = err.code === 'LISTING_INVALID_FILTERS' ? 409
        : err.code === 'SESSION_NOT_FOUND' ? 404 : 500;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    log.error({ err: (err as Error).message }, 'company_update_unexpected');
    return NextResponse.json({ error: 'server_error', message: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return NextResponse.json({ error: 'bad_id' }, { status: 400 });
  boot.companies.delete(id);
  return NextResponse.json({ ok: true });
}
