import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getEvent, updateEvent, deleteEvent, EVENT_STATUSES, type EventStatus } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId, isAdmin: user.role === 'admin' };
}

// GET — detalle del evento con sus tareas y quiénes las tomaron.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const data = await getEvent(Number(id));
    if (!data) return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Gestión Social getEvent:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el evento.' }, { status: 500 });
  }
}

// PATCH — edita los datos del evento (o publica/cancela cambiando `status`).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const b = await req.json();
    // El inicio y el fin NO se cambian por aquí: tienen su propio endpoint con reglas.
    if (b.status && !EVENT_STATUSES.includes(b.status)) {
      return NextResponse.json({ error: 'Estado no válido.' }, { status: 400 });
    }
    if (b.status === 'active' || b.status === 'finished') {
      return NextResponse.json({ error: 'Usa el endpoint de inicio/fin para ese estado.' }, { status: 400 });
    }
    await updateEvent(Number(id), {
      name: b.name !== undefined ? String(b.name) : undefined,
      description: b.description !== undefined ? String(b.description) : undefined,
      location: b.location !== undefined ? String(b.location) : undefined,
      eventDate: b.eventDate !== undefined ? String(b.eventDate) : undefined,
      startTime: b.startTime !== undefined ? b.startTime : undefined,
      endTime: b.endTime !== undefined ? b.endTime : undefined,
      allDay: b.allDay !== undefined ? !!b.allDay : undefined,
      status: b.status as EventStatus | undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Gestión Social updateEvent:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar el evento.' }, { status: 500 });
  }
}

// DELETE — elimina el evento (sus tareas y tomas caen por FK ON DELETE CASCADE).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    await deleteEvent(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Gestión Social deleteEvent:', err.message);
    return NextResponse.json({ error: 'No se pudo eliminar el evento.' }, { status: 500 });
  }
}
