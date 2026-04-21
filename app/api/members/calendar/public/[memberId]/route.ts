import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type RouteCtx = { params: Promise<{ memberId: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const { memberId } = await ctx.params;
    const token = req.nextUrl.searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 });

    const memberRes = await pool.query(
      `SELECT id, name, email, calendar_public_token
       FROM gcc_world.members
       WHERE id = $1 AND calendar_public_token = $2 LIMIT 1`,
      [memberId, token],
    );
    const member = memberRes.rows[0];
    if (!member) return NextResponse.json({ error: 'Enlace inválido o revocado' }, { status: 404 });

    const { rows: events } = await pool.query(
      `SELECT
         e.id, e.title, e.description, e.event_type, e.client_id,
         c.name AS client_name,
         e.start_at, e.end_at, e.all_day, e.timezone,
         e.recurrence_type, e.recurrence_days, e.recurrence_interval, e.recurrence_until,
         e.color, e.status
       FROM gcc_world.member_calendar_events e
       LEFT JOIN gcc_world.clients c ON c.id = e.client_id
       WHERE e.member_id = $1 AND e.status <> 'cancelled'
       ORDER BY e.start_at`,
      [memberId],
    );

    return NextResponse.json({
      member: { id: member.id, name: member.name },
      events,
    });
  } catch (err: any) {
    console.error('Public calendar GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
