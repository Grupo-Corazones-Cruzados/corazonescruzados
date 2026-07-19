import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { getEvent } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

/**
 * GET — detalle de un evento para el miembro/candidato: sus tareas con plazas libres y
 * cuál tomó él (`mine`). Un evento en borrador no es visible desde aquí.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await params;
    const event = await getEvent(Number(id), subject);
    if (!event) return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 });
    // Un borrador (o un evento cancelado) solo es visible si la persona ya participaba.
    if ((event.status === 'draft' || event.status === 'cancelled') && !event.myTaskId) {
      return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 });
    }
    // El miembro ve el NOMBRE de quienes participan (es un evento social), pero no sus
    // identificadores internos: se recorta `signups` a lo mostrable.
    const safe = {
      ...event,
      tasks: (event.tasks || []).map((t) => ({
        ...t,
        signups: (t.signups || []).map((s) => ({ name: s.name, status: s.status })),
      })),
    };
    return NextResponse.json({ data: { subject, event: safe } });
  } catch (err: any) {
    console.error('Experiencias detail:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el evento.' }, { status: 500 });
  }
}
