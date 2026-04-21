import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

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
      `SELECT
         e.id, e.title, e.description,
         e.start_at, e.end_at, e.timezone,
         e.recurrence_type, e.recurrence_days, e.recurrence_interval, e.recurrence_until,
         e.created_at,
         u.id AS proposer_id,
         u.email AS proposer_email,
         u.first_name AS proposer_first_name,
         u.last_name AS proposer_last_name
       FROM gcc_world.member_calendar_events e
       LEFT JOIN gcc_world.users u ON u.id = e.created_by
       WHERE e.member_id = $1 AND e.status = 'proposed'
       ORDER BY e.start_at`,
      [memberId],
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Proposals GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar propuestas' }, { status: 500 });
  }
}
