import { NextRequest, NextResponse } from 'next/server';
import { SessionIdInput } from '@server/validation';
import { browserSessionStore } from '@server/sri/browserSessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = SessionIdInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  await browserSessionStore.destroy(parsed.data.sessionId);
  return new NextResponse(null, { status: 204 });
}
