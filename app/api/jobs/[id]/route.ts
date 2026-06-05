import { NextResponse } from 'next/server';
import { getJobState } from '@server/jobs/jobStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getJobState(id);
  if (!s) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    id: s.id, status: s.status, total: s.total, done: s.done, failed: s.failed, skipped: s.skipped,
    startedAt: s.startedAt.toISOString(), finishedAt: s.finishedAt?.toISOString(), error: s.error
  });
}
