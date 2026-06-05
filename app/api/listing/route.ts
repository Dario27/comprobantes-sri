import { NextRequest, NextResponse } from 'next/server';
import { ListingInput } from '@server/validation';
import { browserSessionStore } from '@server/sri/browserSessionStore';
import { listFacturasViaBrowser } from '@server/sri/listingPuppeteer';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const log = childLogger('api:listing');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ListingInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad_input', detail: parsed.error.format() }, { status: 400 });

  const entry = browserSessionStore.get(parsed.data.sessionId);
  if (!entry) return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 401 });

  try {
    const items = await listFacturasViaBrowser(entry.session.page, {
      anio: parsed.data.filters.anio,
      mes: parsed.data.filters.mes,
      dia: parsed.data.filters.dia,
      tipoComprobante: parsed.data.filters.tipoComprobante
    });
    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof SriError) {
      log.warn({ code: err.code, message: err.message }, 'listing_failed');
      const status = err.code === 'SESSION_EXPIRED' ? 401 : 502;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    const message = err instanceof Error ? err.message : 'unknown';
    log.error({ message, stack: (err as Error)?.stack }, 'listing_unexpected');
    return NextResponse.json({ error: 'unknown', message }, { status: 500 });
  }
}
