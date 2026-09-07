import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { generarEntregable } from '@/lib/centralized/generacion-contenido-ia';
import { isEntregableTipo } from '@/lib/centralized/generacion-contenido';

// UN entregable por petición. Un botón que los generara todos de una llamada se caería
// entero al primer tropiezo, llevándose por delante lo que ya estaba bien.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const { tipo } = await req.json();
    if (!isEntregableTipo(String(tipo))) {
      return NextResponse.json({ error: 'Entregable desconocido.' }, { status: 400 });
    }
    const res = await generarEntregable(Number(id), tipo, user.userId, user.role === 'admin');
    return NextResponse.json({ data: res });
  } catch (err: any) {
    console.error('Generación de contenido generar error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
