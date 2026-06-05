import { NextRequest, NextResponse } from 'next/server';
import { HistoryQuery } from '@server/validation';
import { boot } from '@server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = HistoryQuery.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  const rows = boot.db.listHistory(parsed.data);
  return NextResponse.json({ items: rows });
}
