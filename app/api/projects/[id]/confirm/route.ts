import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    // Calculate final cost from accepted bids
    const bidsRes = await pool.query(
      `SELECT COALESCE(SUM(bid_amount), 0) as total FROM gcc_world.project_bids WHERE project_id = $1 AND status = 'accepted'`,
      [id]
    );

    const { rows } = await pool.query(
      `UPDATE gcc_world.projects SET confirmed_at = NOW(), final_cost = $1, status = 'in_progress', updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [bidsRes.rows[0].total, id]
    );
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
