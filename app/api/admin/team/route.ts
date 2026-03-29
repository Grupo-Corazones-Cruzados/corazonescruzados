import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });

    const { rows } = await pool.query(
      `SELECT m.id, m.name, m.email, m.hourly_rate, m.is_active,
              p.name as position_name,
              u.role, u.avatar_url
       FROM gcc_world.members m
       LEFT JOIN gcc_world.positions p ON p.id = m.position_id
       LEFT JOIN gcc_world.users u ON u.member_id::bigint = m.id
       ORDER BY m.id`
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Team error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
