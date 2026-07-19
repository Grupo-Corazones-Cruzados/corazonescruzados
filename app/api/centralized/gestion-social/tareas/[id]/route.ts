import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { updateTask, deleteTask, sanitizeTags } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId };
}

// PATCH — edita una tarea del evento (título, detalle, etiquetas, plazas, horario propio).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const b = await req.json();
    const patch: Parameters<typeof updateTask>[1] = {};
    if (b.title !== undefined) {
      if (!String(b.title).trim()) return NextResponse.json({ error: 'El título es obligatorio.' }, { status: 400 });
      patch.title = String(b.title);
    }
    if (b.detail !== undefined) patch.detail = String(b.detail);
    if (b.values !== undefined || b.talents !== undefined) {
      const { values, talents } = sanitizeTags(b);
      if (b.values !== undefined) patch.values = values;
      if (b.talents !== undefined) patch.talents = talents;
    }
    if (b.plazas !== undefined) {
      const plazas = Number(b.plazas);
      if (!Number.isFinite(plazas) || plazas < 1) {
        return NextResponse.json({ error: 'Las plazas deben ser al menos 1.' }, { status: 400 });
      }
      patch.plazas = plazas;
    }
    if (b.startTime !== undefined) patch.startTime = b.startTime || null;
    if (b.endTime !== undefined) patch.endTime = b.endTime || null;
    await updateTask(Number(id), patch);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Gestión Social updateTask:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar la tarea.' }, { status: 500 });
  }
}

// DELETE — elimina la tarea (sus tomas caen por FK ON DELETE CASCADE).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    await deleteTask(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Gestión Social deleteTask:', err.message);
    return NextResponse.json({ error: 'No se pudo eliminar la tarea.' }, { status: 500 });
  }
}
