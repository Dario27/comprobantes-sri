import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { boot } from '@server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readFromDisk(filePath: string): Promise<Buffer | null> {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(boot.downloadDir))) return null;
  try {
    return await fs.readFile(resolved);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ claveAcceso: string; kind: string }> }) {
  const { claveAcceso, kind } = await params;
  if (kind !== 'xml' && kind !== 'ride') {
    return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
  }
  const rec = boot.db.findByClaveAcceso(claveAcceso);
  if (!rec) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (kind === 'xml') {
    if (rec.xmlContent && rec.xmlContent.length > 0) {
      return new NextResponse(new Uint8Array(rec.xmlContent), {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="${claveAcceso}.xml"`
        }
      });
    }
    if (rec.xmlPath) {
      const data = await readFromDisk(rec.xmlPath);
      if (!data) return NextResponse.json({ error: 'read_failed' }, { status: 500 });
      return new NextResponse(new Uint8Array(data), {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="${claveAcceso}.xml"`
        }
      });
    }
    return NextResponse.json({ error: 'file_missing' }, { status: 404 });
  }

  // kind === 'ride': sólo disco (registros antiguos).
  if (!rec.ridePath) return NextResponse.json({ error: 'file_missing' }, { status: 404 });
  const data = await readFromDisk(rec.ridePath);
  if (!data) return NextResponse.json({ error: 'read_failed' }, { status: 500 });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${claveAcceso}.pdf"`
    }
  });
}
