/** Reordena los conceptos de un talento. Solo administradores. */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { reordenarConceptos } from '@/lib/soluciones';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.some((x) => !Number.isFinite(Number(x)))) {
    return NextResponse.json({ error: 'Se esperaba una lista de ids' }, { status: 400 });
  }
  await reordenarConceptos(ids.map(Number));
  return NextResponse.json({ ok: true });
}
