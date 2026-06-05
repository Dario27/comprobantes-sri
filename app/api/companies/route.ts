import { NextResponse } from 'next/server';
import { boot } from '@server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lista pública (para el selector "Conectar al SRI"). Solo expone campos no sensibles;
// nunca las credenciales. La gestión (crear/editar/borrar) vive bajo /api/admin/companies.
export async function GET() {
  const items = boot.companies.list().map((c) => ({
    id: c.id,
    nombre: c.nombre,
    ruc: c.ruc,
    estado: c.estado,
  }));
  return NextResponse.json({ items });
}
