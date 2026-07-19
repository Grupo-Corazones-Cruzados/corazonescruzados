import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { createTask, sanitizeTags } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId };
}

// POST — agrega una tarea al evento (con etiquetas de valores/talentos y plazas).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const b = await req.json();
    if (!b?.title?.trim()) return NextResponse.json({ error: 'El título de la tarea es obligatorio.' }, { status: 400 });
    const plazas = Number(b.plazas);
    if (!Number.isFinite(plazas) || plazas < 1) {
      return NextResponse.json({ error: 'Las plazas deben ser al menos 1.' }, { status: 400 });
    }
    const { values, talents } = sanitizeTags(b);
    const data = await createTask(Number(id), {
      title: String(b.title),
      detail: b.detail ? String(b.detail) : '',
      values, talents, plazas,
      startTime: b.startTime || null,
      endTime: b.endTime || null,
    });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Gestión Social createTask:', err.message);
    return NextResponse.json({ error: 'No se pudo crear la tarea.' }, { status: 500 });
  }
}
