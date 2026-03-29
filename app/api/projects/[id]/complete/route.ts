import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { action, review_deadline } = await req.json();

    if (action === 'confirm_completion') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'completed', updated_at = NOW() WHERE id = $1`, [id]);
    } else if (action === 'request_review') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'review', review_deadline = $1, updated_at = NOW() WHERE id = $2`, [review_deadline, id]);
    } else if (action === 'more_requirements') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [id]);
    }

    const { rows } = await pool.query(`SELECT * FROM gcc_world.projects WHERE id = $1`, [id]);
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
