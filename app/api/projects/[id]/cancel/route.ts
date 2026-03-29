import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT cr.*, u.first_name, u.last_name
       FROM gcc_world.project_cancellation_requests cr
       LEFT JOIN gcc_world.users u ON u.id = cr.requested_by
       WHERE cr.project_id = $1
       ORDER BY cr.created_at DESC`,
      [id]
    );

    const totalAccepted = await pool.query(
      `SELECT COUNT(*) FROM gcc_world.project_bids WHERE project_id = $1 AND status = 'accepted'`, [id]
    );

    // Get votes for each request
    for (const r of rows) {
      const votes = await pool.query(
        `SELECT v.*, m.name as member_name FROM gcc_world.project_cancellation_votes v
         JOIN gcc_world.members m ON m.id = v.member_id WHERE v.request_id = $1`, [r.id]
      );
      r.votes = votes.rows;
    }

    return NextResponse.json({
      data: rows,
      meta: {
        total_requests: rows.length,
        has_pending: rows.some((r: any) => r.status === 'pending'),
        max_requests: 3,
        total_accepted_members: Number(totalAccepted.rows[0].count),
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { reason } = await req.json();

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_cancellation_requests (project_id, requested_by, reason)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, user.userId, reason]
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { request_id, status } = await req.json();

    await pool.query(
      `UPDATE gcc_world.project_cancellation_requests SET status = $1, resolved_at = NOW(), resolved_by = $2 WHERE id = $3`,
      [status, user.userId, request_id]
    );

    if (status === 'approved') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id]);
    }

    return NextResponse.json({ message: 'Updated' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
