import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { notifyCalendarSubscribers } from '@/lib/calendar/notify';

async function resolveMemberId(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT member_id FROM gcc_world.users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.member_id || null;
}

const SELECT_SQL = `
  SELECT
    e.id,
    e.member_id,
    e.title,
    e.description,
    e.event_type,
    e.client_id,
    c.name AS client_name,
    e.start_at,
    e.end_at,
    e.all_day,
    e.timezone,
    e.recurrence_type,
    e.recurrence_days,
    e.recurrence_interval,
    e.recurrence_until,
    e.color,
    e.status,
    e.created_at,
    e.updated_at
  FROM gcc_world.member_calendar_events e
  LEFT JOIN gcc_world.clients c ON c.id = e.client_id
`;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ data: [] });

    const { rows } = await pool.query(
      `${SELECT_SQL} WHERE e.member_id = $1 ORDER BY e.start_at`,
      [memberId],
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Calendar GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar eventos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const body = await req.json();
    const err = validateEventPayload(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const {
      title,
      description = null,
      event_type,
      client_id = null,
      start_at,
      end_at,
      all_day = false,
      timezone = 'America/Guayaquil',
      recurrence_type = 'none',
      recurrence_days = null,
      recurrence_interval = 1,
      recurrence_until = null,
      color = null,
    } = body;

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.member_calendar_events (
         member_id, title, description, event_type, client_id,
         start_at, end_at, all_day, timezone,
         recurrence_type, recurrence_days, recurrence_interval, recurrence_until,
         color, status, created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13,
         $14, 'confirmed', $15
       ) RETURNING id`,
      [
        memberId, title, description, event_type,
        event_type === 'work' ? client_id : null,
        start_at, end_at, all_day, timezone,
        recurrence_type,
        recurrence_type === 'weekly' ? recurrence_days : null,
        recurrence_interval,
        recurrence_until,
        color,
        user.userId,
      ],
    );

    const created = await pool.query(`${SELECT_SQL} WHERE e.id = $1`, [rows[0].id]);
    const ev = created.rows[0];
    notifyCalendarSubscribers({
      memberId,
      action: 'created',
      eventTitle: ev.title,
      eventStart: new Date(ev.start_at),
      eventEnd: new Date(ev.end_at),
    });
    return NextResponse.json({ data: ev }, { status: 201 });
  } catch (err: any) {
    console.error('Calendar POST error:', err.message);
    return NextResponse.json({ error: 'Error al crear evento' }, { status: 500 });
  }
}

function validateEventPayload(b: any): string | null {
  if (!b || typeof b !== 'object') return 'Payload inválido';
  if (!b.title || typeof b.title !== 'string' || !b.title.trim()) return 'Título requerido';
  if (!['work', 'personal'].includes(b.event_type)) return 'Tipo inválido';
  if (b.event_type === 'work' && !b.client_id) return 'Cliente requerido para eventos laborales';
  if (!b.start_at || !b.end_at) return 'Fechas de inicio y fin requeridas';
  if (new Date(b.end_at).getTime() < new Date(b.start_at).getTime()) {
    return 'La fecha fin no puede ser anterior al inicio';
  }
  if (b.recurrence_type && !['none', 'daily', 'weekly', 'monthly'].includes(b.recurrence_type)) {
    return 'Tipo de recurrencia inválido';
  }
  if (b.recurrence_type === 'weekly' && (!Array.isArray(b.recurrence_days) || b.recurrence_days.length === 0)) {
    return 'Selecciona al menos un día de la semana';
  }
  return null;
}
