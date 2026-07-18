import { getCurrentUser } from '@/lib/auth/jwt';
import { getCaptura, deleteCaptura } from '@/lib/centralized/percepcion-db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: Number(user.userId), isAdmin: user.role === 'admin' };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const captura = await getCaptura(Number(id), g.userId, g.isAdmin);
    if (!captura) return NextResponse.json({ error: 'Captura no encontrada' }, { status: 404 });
    return NextResponse.json({ data: captura });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const ok = await deleteCaptura(Number(id), g.userId, g.isAdmin);
    if (!ok) return NextResponse.json({ error: 'Captura no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
