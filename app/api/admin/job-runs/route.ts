import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@server/bootstrap';
import { JobRunQuery } from '@server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const parsed = JobRunQuery.safeParse(Object.fromEntries(sp.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_input', detail: parsed.error.format() }, { status: 400 });
  }
  const items = boot.jobRuns.list(parsed.data);
  return NextResponse.json({ items });
}
