import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { editarEntregable } from '@/lib/centralized/generacion-contenido-db';

// La corrección a mano de un guion, «por encima» de lo que escribió el agente.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const { texto } = await req.json();
    if (typeof texto !== 'string') return NextResponse.json({ error: 'Falta el texto.' }, { status: 400 });
    const data = await editarEntregable(Number(id), user.userId, user.role === 'admin', texto);
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Generación de contenido entregable PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
