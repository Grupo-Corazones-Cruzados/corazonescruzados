import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { listEventsForSubject } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

/**
 * GET — eventos visibles para el miembro/candidato logueado (publicados o en curso, más
 * aquellos ya finalizados en los que participó). `myTaskId` indica la tarea que ya tomó.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    // Sin sujeto (p. ej. un cliente puro) no hay experiencias que mostrar: lista vacía.
    if (!subject) return NextResponse.json({ data: { subject: null, events: [] } });
    const events = await listEventsForSubject(subject.kind, subject.id);
    return NextResponse.json({ data: { subject, events } });
  } catch (err: any) {
    console.error('Experiencias list:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar las experiencias.' }, { status: 500 });
  }
}
