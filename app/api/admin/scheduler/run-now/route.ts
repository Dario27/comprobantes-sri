import { NextRequest, NextResponse } from 'next/server';
import { RunNowBody } from '@server/validation';
import { runJobForCompany } from '@server/scheduler/engine';
import { childLogger } from '@server/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const log = childLogger('api:admin:scheduler:run-now');

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RunNowBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_input', detail: parsed.error.format() }, { status: 400 });
  }
  try {
    const result = await runJobForCompany(parsed.data.companyId, 'MANUAL');
    return NextResponse.json(result);
  } catch (err) {
    log.error({ err: (err as Error).message }, 'run_now_failed');
    return NextResponse.json({ error: 'server_error', message: (err as Error).message }, { status: 500 });
  }
}
