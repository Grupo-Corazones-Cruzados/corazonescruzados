import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolverDenuncia } from '@/lib/moderacion';

export const dynamic = 'force-dynamic';

/** PATCH { accion: 'retirar' | 'descartar' } — solo administradores. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  try {
    const { accion } = await req.json();
    if (accion !== 'retirar' && accion !== 'descartar') throw new Error('Acción no válida');
    await resolverDenuncia(Number(id), accion, user.userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo resolver' }, { status: 400 });
  }
}
