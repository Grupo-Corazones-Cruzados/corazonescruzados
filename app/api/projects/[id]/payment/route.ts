import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.project_payments WHERE project_id = $1 ORDER BY created_at DESC`, [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { proof_url, amount } = await req.json();

    // Replace rejected payment if exists
    await pool.query(`DELETE FROM gcc_world.project_payments WHERE project_id = $1 AND status = 'rejected'`, [id]);

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_payments (project_id, amount, proof_url)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, amount || 0, proof_url]
    );

    await pool.query(`UPDATE gcc_world.projects SET status = 'completed', updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { payment_id, status, notes } = await req.json();

    await pool.query(
      `UPDATE gcc_world.project_payments SET status = $1, notes = $2, confirmed_by = $3, confirmed_at = NOW() WHERE id = $4`,
      [status, notes || null, user.userId, payment_id]
    );

    // Get project_id to update status
    const payRes = await pool.query(`SELECT project_id FROM gcc_world.project_payments WHERE id = $1`, [payment_id]);
    const projectId = payRes.rows[0]?.project_id;

    if (status === 'confirmed') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'closed', updated_at = NOW() WHERE id = $1`, [projectId]);
    } else if (status === 'rejected') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [projectId]);
    }

    return NextResponse.json({ message: 'Updated' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
