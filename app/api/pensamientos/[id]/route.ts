import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { updateThought, deleteThought } from '@/lib/centralized/pensamientos-db';

export const dynamic = 'force-dynamic';

const MAX_LEN = 50000;

async function subjectOf() {
  const user = await getCurrentUser();
  if (!user) return null;
  return resolveSubject(user);
}

/** PATCH — edita el texto. Al cambiarlo se limpia la categoría para que la IA reetiquete. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const subject = await subjectOf();
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const b = await req.json();
    const content = String(b?.content ?? '').trim();
    if (!content) return NextResponse.json({ error: 'El pensamiento está vacío.' }, { status: 400 });
    if (content.length > MAX_LEN) return NextResponse.json({ error: `Máximo ${MAX_LEN} caracteres.` }, { status: 400 });
    await updateThought(subject, Number(id), content);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // "No se encontró" incluye el caso de una fila ajena: no se distingue a propósito.
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const subject = await subjectOf();
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    await deleteThought(subject, Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}
