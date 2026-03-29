import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { request_id, vote, comment } = await req.json();

    // Get member_id
    const memberRes = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    const memberId = memberRes.rows[0]?.member_id;
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_cancellation_votes (request_id, member_id, user_id, vote, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [request_id, memberId, user.userId, vote, comment || null]
    );

    // Check if all accepted members voted
    const reqRes = await pool.query(`SELECT project_id FROM gcc_world.project_cancellation_requests WHERE id = $1`, [request_id]);
    const projectId = reqRes.rows[0]?.project_id;

    const totalAccepted = await pool.query(
      `SELECT COUNT(*) FROM gcc_world.project_bids WHERE project_id = $1 AND status = 'accepted'`, [projectId]
    );
    const totalVotes = await pool.query(
      `SELECT COUNT(*) FROM gcc_world.project_cancellation_votes WHERE request_id = $1`, [request_id]
    );
    const rejectVotes = await pool.query(
      `SELECT COUNT(*) FROM gcc_world.project_cancellation_votes WHERE request_id = $1 AND vote = 'reject'`, [request_id]
    );

    if (Number(rejectVotes.rows[0].count) > 0) {
      await pool.query(`UPDATE gcc_world.project_cancellation_requests SET status = 'rejected', resolved_at = NOW() WHERE id = $1`, [request_id]);
    } else if (Number(totalVotes.rows[0].count) >= Number(totalAccepted.rows[0].count)) {
      await pool.query(`UPDATE gcc_world.project_cancellation_requests SET status = 'approved', resolved_at = NOW() WHERE id = $1`, [request_id]);
      await pool.query(`UPDATE gcc_world.projects SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [projectId]);
    }

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
