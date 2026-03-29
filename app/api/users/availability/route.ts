import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { rows } = await pool.query(
      `SELECT u.member_id FROM gcc_world.users u WHERE u.id = $1`,
      [user.userId]
    );
    if (!rows[0]?.member_id) return NextResponse.json({ schedule: null });

    const scheduleRes = await pool.query(
      `SELECT day_of_week, is_active, start_time, end_time
       FROM gcc_world.member_schedules
       WHERE member_id = $1
       ORDER BY day_of_week`,
      [rows[0].member_id]
    );

    if (scheduleRes.rows.length === 0) return NextResponse.json({ schedule: null });

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedule: Record<string, any> = {};
    scheduleRes.rows.forEach((r: any) => {
      const dayKey = days[r.day_of_week - 1] || `day_${r.day_of_week}`;
      schedule[dayKey] = {
        active: r.is_active,
        start: r.start_time?.slice(0, 5) || '09:00',
        end: r.end_time?.slice(0, 5) || '17:00',
      };
    });

    return NextResponse.json({ schedule });
  } catch (err: any) {
    console.error('Availability GET error:', err.message);
    return NextResponse.json({ schedule: null });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { rows } = await pool.query(
      `SELECT member_id FROM gcc_world.users WHERE id = $1`,
      [user.userId]
    );
    if (!rows[0]?.member_id) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const memberId = rows[0].member_id;
    const { schedule } = await req.json();
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    await pool.query('DELETE FROM gcc_world.member_schedules WHERE member_id = $1', [memberId]);

    for (let i = 0; i < days.length; i++) {
      const day = schedule[days[i]];
      if (!day) continue;
      await pool.query(
        `INSERT INTO gcc_world.member_schedules (member_id, day_of_week, is_active, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [memberId, i + 1, day.active, day.start, day.end]
      );
    }

    return NextResponse.json({ message: 'Disponibilidad actualizada' });
  } catch (err: any) {
    console.error('Availability PUT error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}
