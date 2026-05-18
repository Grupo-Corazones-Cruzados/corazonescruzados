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
    e.id, e.member_id, e.title, e.description, e.event_type, e.client_id,
    c.name AS client_name,
    e.start_at, e.end_at, e.all_day, e.timezone,
    e.recurrence_type, e.recurrence_days, e.recurrence_interval, e.recurrence_until,
    e.color, e.status, e.created_at, e.updated_at
  FROM gcc_world.member_calendar_events e
  LEFT JOIN gcc_world.clients c ON c.id = e.client_id
`;

type RouteCtx = { params: Promise<{ eventId: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { eventId } = await ctx.params;
    const { rows } = await pool.query(
      `${SELECT_SQL} WHERE e.id = $1 AND e.member_id = $2`,
      [eventId, memberId],
    );
    if (!rows[0]) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Calendar event GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar evento' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { eventId } = await ctx.params;
    const b = await req.json();

    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    const push = (col: string, val: any) => {
      fields.push(`${col} = $${i++}`);
      values.push(val);
    };

    if (typeof b.title === 'string') push('title', b.title);
    if ('description' in b) push('description', b.description);
    if (b.event_type && ['work', 'personal'].includes(b.event_type)) {
      push('event_type', b.event_type);
      push('client_id', b.event_type === 'work' ? (b.client_id || null) : null);
    } else if ('client_id' in b) {
      push('client_id', b.client_id);
    }
    if (b.start_at) push('start_at', b.start_at);
    if (b.end_at) push('end_at', b.end_at);
    if (typeof b.all_day === 'boolean') push('all_day', b.all_day);
    if (b.timezone) push('timezone', b.timezone);
    if (b.recurrence_type && ['none', 'daily', 'weekly', 'monthly'].includes(b.recurrence_type)) {
      push('recurrence_type', b.recurrence_type);
      push('recurrence_days', b.recurrence_type === 'weekly' ? (b.recurrence_days || null) : null);
    }
    if (typeof b.recurrence_interval === 'number') push('recurrence_interval', b.recurrence_interval);
    if ('recurrence_until' in b) push('recurrence_until', b.recurrence_until);
    if ('color' in b) push('color', b.color);

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    values.push(eventId, memberId);
    const result = await pool.query(
      `UPDATE gcc_world.member_calendar_events
         SET ${fields.join(', ')}
       WHERE id = $${i++} AND member_id = $${i++}
       RETURNING id`,
      values,
    );
    if (result.rowCount === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { rows } = await pool.query(`${SELECT_SQL} WHERE e.id = $1`, [eventId]);
    const ev = rows[0];
    if (ev) {
      notifyCalendarSubscribers({
        memberId,
        action: 'updated',
        eventTitle: ev.title,
        eventStart: new Date(ev.start_at),
        eventEnd: new Date(ev.end_at),
      });
    }
    return NextResponse.json({ data: ev });
  } catch (err: any) {
    console.error('Calendar event PATCH error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar evento' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { eventId } = await ctx.params;
    const existing = await pool.query(
      `SELECT title, start_at, end_at FROM gcc_world.member_calendar_events
       WHERE id = $1 AND member_id = $2`,
      [eventId, memberId],
    );
    if (existing.rowCount === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    await pool.query(
      `DELETE FROM gcc_world.member_calendar_events WHERE id = $1 AND member_id = $2`,
      [eventId, memberId],
    );

    const prev = existing.rows[0];
    notifyCalendarSubscribers({
      memberId,
      action: 'deleted',
      eventTitle: prev.title,
      eventStart: new Date(prev.start_at),
      eventEnd: new Date(prev.end_at),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Calendar event DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al eliminar evento' }, { status: 500 });
  }
}
