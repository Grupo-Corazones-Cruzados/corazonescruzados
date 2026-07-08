import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectsCriteria } from '@/lib/centralized/criteria';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });

    const { rows } = await pool.query(
      `SELECT m.id, m.name, m.email, m.hourly_rate, m.is_active, m.piso, m.paso,
              p.name as position_name,
              u.role, u.avatar_url
       FROM gcc_world.members m
       LEFT JOIN gcc_world.positions p ON p.id = m.position_id
       LEFT JOIN gcc_world.users u ON u.member_id::bigint = m.id
       ORDER BY m.id`
    );

    // Criterios de desarrollo del miembro (para la prospección), igual que candidatos.
    const criteriaBy = await getSubjectsCriteria('member', rows.map((r: any) => String(r.id)));
    const data = rows.map((r: any) => ({ ...r, criteria: criteriaBy[String(r.id)] ?? null }));

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Team error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
