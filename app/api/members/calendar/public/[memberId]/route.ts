import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type RouteCtx = { params: Promise<{ memberId: string }> };

// Color neutro de los bloques "Ocupado" del calendario público (no revela categoría).
const BUSY_COLOR = '#64748b'; // slate-500

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const { memberId } = await ctx.params;
    const token = req.nextUrl.searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 });

    const memberRes = await pool.query(
      `SELECT id, name, email, calendar_public_token,
              availability_status, availability_updated_at
       FROM gcc_world.members
       WHERE id = $1 AND calendar_public_token = $2 LIMIT 1`,
      [memberId, token],
    );
    const member = memberRes.rows[0];
    if (!member) return NextResponse.json({ error: 'Enlace inválido o revocado' }, { status: 404 });

    const { rows } = await pool.query(
      `SELECT
         e.id,
         e.start_at, e.end_at, e.all_day, e.timezone,
         e.recurrence_type, e.recurrence_days, e.recurrence_interval, e.recurrence_until,
         e.status
       FROM gcc_world.member_calendar_events e
       WHERE e.member_id = $1 AND e.status <> 'cancelled'
       ORDER BY e.start_at`,
      [memberId],
    );

    // CONFIDENCIALIDAD: el calendario público es "libre/ocupado". Nunca se expone el
    // título, la descripción, el cliente ni la categoría (personal/laboral) de los
    // eventos del miembro; el visitante solo ve QUÉ franjas están ocupadas para poder
    // agendar. Se normaliza todo a un bloque neutro "Ocupado".
    const events = rows.map((e: any) => ({
      id: e.id,
      title: 'Ocupado',
      description: null,
      event_type: 'personal',
      client_id: null,
      client_name: null,
      start_at: e.start_at,
      end_at: e.end_at,
      all_day: e.all_day,
      timezone: e.timezone,
      recurrence_type: e.recurrence_type,
      recurrence_days: e.recurrence_days,
      recurrence_interval: e.recurrence_interval,
      recurrence_until: e.recurrence_until,
      color: BUSY_COLOR,
      status: e.status,
    }));

    return NextResponse.json({
      member: {
        id: member.id,
        name: member.name,
        availability_status: member.availability_status || 'conectado',
        availability_updated_at: member.availability_updated_at || null,
      },
      events,
    });
  } catch (err: any) {
    console.error('Public calendar GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
