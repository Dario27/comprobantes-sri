import { NextRequest, NextResponse } from 'next/server';
import { getPortalSession } from '@server/portalSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const res = NextResponse.json({});
  const session = await getPortalSession(req, res);
  if (!session.userId) {
    return NextResponse.json({ error: 'PORTAL_UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({ user: { username: session.username, rol: session.rol } });
}
