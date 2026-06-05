import { NextResponse } from 'next/server';
import { getJobState } from '@server/jobs/jobStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getJobState(id);
  if (!s) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  s.abort.abort();
  return new NextResponse(null, { status: 204 });
}
