import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gcc_world.project_requests (
        id SERIAL PRIMARY KEY, project_id INT NOT NULL, member_id INT NOT NULL,
        type VARCHAR(30) NOT NULL, reason TEXT NOT NULL, status VARCHAR(30) DEFAULT 'pending',
        reviewed_by TEXT, review_note TEXT, fee_amount NUMERIC(12,2),
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    if (user.role === 'admin') {
      // Admin sees all supervised_exit requests
      const { rows } = await pool.query(
        `SELECT pr.*, m.name as member_name, m.photo_url, p.title as project_title
         FROM gcc_world.project_requests pr
         JOIN gcc_world.members m ON m.id = pr.member_id
         JOIN gcc_world.projects p ON p.id = pr.project_id
         ORDER BY pr.created_at DESC`
      );
      return NextResponse.json({ data: rows });
    }

    // Member: see own requests
    const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    if (!u?.member_id) return NextResponse.json({ data: [] });

    const { rows } = await pool.query(
      `SELECT pr.*, p.title as project_title
       FROM gcc_world.project_requests pr
       JOIN gcc_world.projects p ON p.id = pr.project_id
       WHERE pr.member_id = $1
       ORDER BY pr.created_at DESC`,
      [u.member_id]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
