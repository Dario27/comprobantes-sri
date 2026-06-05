import { NextRequest, NextResponse } from 'next/server';
import { ListingInput } from '@server/validation';
import { browserSessionStore } from '@server/sri/browserSessionStore';
import { applyFilters } from '@server/sri/listingPuppeteer';
import { downloadTxtReport } from '@server/sri/downloaderPuppeteer';
import { SriError } from '@server/errors';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const log = childLogger('api:listing:txt');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ListingInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_input', detail: parsed.error.format() }, { status: 400 });
  }

  const entry = browserSessionStore.get(parsed.data.sessionId);
  if (!entry) {
    return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 401 });
  }

  try {
    const { page } = entry.session;
    const f = {
      anio: parsed.data.filters.anio,
      mes: parsed.data.filters.mes,
      dia: parsed.data.filters.dia,
      tipoComprobante: parsed.data.filters.tipoComprobante
    };

    await applyFilters(page, f);
    const buf = await downloadTxtReport(page, entry.session.downloadPath);

    const filename = `reporte-${f.anio}-${String(f.mes).padStart(2, '0')}.txt`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (err) {
    if (err instanceof SriError) {
      log.warn({ code: err.code, message: err.message }, 'txt_report_failed');
      const status = err.code === 'SESSION_EXPIRED' ? 401
        : err.code === 'DOWNLOAD_NOT_FOUND' ? 404
        : 502;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    const message = err instanceof Error ? err.message : 'unknown';
    log.error({ message, stack: (err as Error)?.stack }, 'txt_report_unexpected');
    return NextResponse.json({ error: 'unknown', message }, { status: 500 });
  }
}
