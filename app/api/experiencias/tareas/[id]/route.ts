import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { takeTask, releaseTask } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

/**
 * POST — TOMA la tarea y confirma asistencia. A partir de aquí la tarea aparece en el
 * "Mi día" del sujeto (bloqueada hasta que el evento inicie).
 * Falla con 409 si ya no quedan plazas, si el evento no está publicado o si la persona
 * ya tomó otra tarea de ese evento (regla: una sola tarea por evento).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const data = await takeTask(Number(id), subject.kind, subject.id);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}

/** DELETE — SUELTA la tarea y libera la plaza. Solo mientras el evento no haya iniciado. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    await releaseTask(Number(id), subject.kind, subject.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
