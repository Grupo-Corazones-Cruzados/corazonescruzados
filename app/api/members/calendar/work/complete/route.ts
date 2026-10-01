import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { setMemberAvailability } from '@/lib/calendar/availability-db';

/**
 * «Completado» de la ventana de tareas: marca TODAS las tareas de la sesión abierta como
 * hechas y pasa el estado de «Trabajando» a «Conectado», que cierra el bloque. En una sola
 * transacción: si algo falla, ni las tareas quedan completadas ni el estado cambia.
 */
export async function POST() {
  const client = await pool.connect();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { rows: u } = await client.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    const memberId: string | null = u[0]?.member_id || null;
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id FROM gcc_world.member_calendar_events
        WHERE member_id = $1 AND availability_open = TRUE AND availability_status = 'trabajando'
        FOR UPDATE`,
      [memberId],
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No estás en estado «Trabajando»' }, { status: 409 });
    }
    const { rowCount } = await client.query(
      `UPDATE gcc_world.member_work_tasks SET completed_at = NOW()
        WHERE event_id = ANY($1::uuid[]) AND completed_at IS NULL`,
      [rows.map((r: { id: string }) => r.id)],
    );
    await setMemberAvailability(client, memberId, user.userId, 'conectado');
    await client.query('COMMIT');
    return NextResponse.json({ status: 'conectado', completed: rowCount });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Work complete POST error:', err.message);
    return NextResponse.json({ error: 'Error al completar las tareas' }, { status: 500 });
  } finally {
    client.release();
  }
}
