import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { updateRazon, deleteRazon } from '@/lib/razones/db';

export const dynamic = 'force-dynamic';

const MAX_LEN = 50000;

/** PATCH — edita el contenido de una razón (solo su dueño). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { id } = await params;
    const b = await req.json();
    const content = String(b?.content ?? '').trim();
    if (!content) return NextResponse.json({ error: 'La razón está vacía.' }, { status: 400 });
    if (content.length > MAX_LEN) return NextResponse.json({ error: `Máximo ${MAX_LEN} caracteres.` }, { status: 400 });
    const data = await updateRazon(user.userId, id, content);
    if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Razones update:', err.message);
    return NextResponse.json({ error: 'No se pudo actualizar la razón.' }, { status: 500 });
  }
}

/** DELETE — elimina una razón (solo su dueño). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { id } = await params;
    await deleteRazon(user.userId, id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Razones delete:', err.message);
    return NextResponse.json({ error: 'No se pudo eliminar la razón.' }, { status: 500 });
  }
}
