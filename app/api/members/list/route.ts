import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { rows } = await pool.query(
      `SELECT m.id, m.name, m.email, m.photo_url,
              EXISTS (SELECT 1 FROM gcc_world.users u WHERE u.member_id = m.id) AS con_cuenta
         FROM gcc_world.members m WHERE m.is_active = true ORDER BY m.name`
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ data: [] });
  }
}
