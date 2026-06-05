import { NextRequest, NextResponse } from 'next/server';
import { getPortalSession } from '@server/portalSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const session = await getPortalSession(req, res);
  await session.destroy();
  return res;
}
