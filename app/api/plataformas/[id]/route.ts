import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { detallePlataforma } from '@/lib/productos/plataformas';

export const dynamic = 'force-dynamic';

/** El detalle de una plataforma para el panel derecho. Solo su cliente (o el admin). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;
  try {
    const d = await detallePlataforma(Number(id) || 0, user);
    if (!d) return NextResponse.json({ error: 'Plataforma no encontrada' }, { status: 404 });
    return NextResponse.json({ data: d });
  } catch (e: any) {
    console.error('[plataformas] detalle:', e.message);
    return NextResponse.json({ error: 'No se pudo cargar el detalle' }, { status: 500 });
  }
}
