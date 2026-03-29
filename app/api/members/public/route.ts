import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        m.id,
        m.name,
        m.phone,
        m.photo_url,
        p.name AS position,
        cv.bio,
        cv.skills
      FROM gcc_world.members m
      LEFT JOIN gcc_world.positions p ON p.id = m.position_id
      LEFT JOIN gcc_world.member_cv_profiles cv ON cv.member_id = m.id
      WHERE m.is_active = true
      ORDER BY m.id
    `);

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('GET /api/members/public error:', err.message);
    return NextResponse.json({ data: [] }, { status: 500 });
  }
}
