import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { AVAILABILITY, isAvailabilityStatus } from '@/lib/calendar/availability';

async function resolveMemberId(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT member_id FROM gcc_world.users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.member_id || null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { rows } = await pool.query(
      `SELECT availability_status, availability_updated_at
         FROM gcc_world.members WHERE id = $1`,
      [memberId],
    );
    return NextResponse.json({
      status: rows[0]?.availability_status || 'conectado',
      updated_at: rows[0]?.availability_updated_at || null,
    });
  } catch (err: any) {
    console.error('Availability GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar disponibilidad' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const status = body?.status;
    if (!isAvailabilityStatus(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }
    const meta = AVAILABILITY[status];

    await client.query('BEGIN');

    // Cierra la tarea de disponibilidad abierta: su fin = ahora.
    await client.query(
      `UPDATE gcc_world.member_calendar_events
          SET end_at = NOW(), availability_open = FALSE
        WHERE member_id = $1 AND availability_open = TRUE`,
      [memberId],
    );

    await client.query(
      `UPDATE gcc_world.members
          SET availability_status = $1, availability_updated_at = NOW()
        WHERE id = $2`,
      [status, memberId],
    );

    let createdEvent = null;
    if (meta.createsTask) {
      const { rows } = await client.query(
        `INSERT INTO gcc_world.member_calendar_events (
           member_id, title, description, event_type, client_id,
           start_at, end_at, all_day, timezone,
           recurrence_type, recurrence_days, recurrence_interval, recurrence_until,
           color, status, created_by, task_status,
           availability_status, availability_open
         ) VALUES (
           $1, $2, NULL, 'task', NULL,
           NOW(), NOW() + INTERVAL '1 hour', FALSE, 'America/Guayaquil',
           'none', NULL, 1, NULL,
           $3, 'confirmed', $4, 'pending',
           $5, TRUE
         ) RETURNING id, title, start_at, end_at, color`,
        [memberId, meta.taskTitle, meta.color, user.userId, status],
      );
      createdEvent = rows[0];
    }

    await client.query('COMMIT');
    return NextResponse.json({ status, event: createdEvent });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Availability POST error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar disponibilidad' }, { status: 500 });
  } finally {
    client.release();
  }
}
