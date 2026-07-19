import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listEvents, createEvent } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

/** Solo miembros/admin (el sistema vive en el piso controlador). */
async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId, isAdmin: user.role === 'admin' };
}

// GET — lista de eventos (+ conteos por estado para el rail de filtro). `?status=` filtra.
export async function GET(req: NextRequest) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const status = req.nextUrl.searchParams.get('status') || undefined;
    const data = await listEvents(status);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Gestión Social listEvents:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar los eventos.' }, { status: 500 });
  }
}

// POST — crea un evento (nace en 'draft'; se publica al editarlo).
export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const b = await req.json();
    if (!b?.name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.eventDate || ''))) {
      return NextResponse.json({ error: 'La fecha del evento es obligatoria.' }, { status: 400 });
    }
    const data = await createEvent({
      name: String(b.name),
      description: b.description ? String(b.description) : '',
      location: b.location ? String(b.location) : '',
      eventDate: String(b.eventDate),
      startTime: b.startTime || null,
      endTime: b.endTime || null,
      allDay: !!b.allDay,
      createdBy: g.userId,
    });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Gestión Social createEvent:', err.message);
    return NextResponse.json({ error: 'No se pudo crear el evento.' }, { status: 500 });
  }
}
