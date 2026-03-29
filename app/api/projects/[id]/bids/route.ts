import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT pb.*, m.name as member_name, m.email as member_email, m.photo_url
       FROM gcc_world.project_bids pb
       JOIN gcc_world.members m ON m.id = pb.member_id
       WHERE pb.project_id = $1
       ORDER BY pb.created_at`,
      [id]
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
    const body = await req.json();

    // Update existing bid (member submitting proposal)
    if (body.bid_id) {
      const { rows } = await pool.query(
        `UPDATE gcc_world.project_bids
         SET proposal = $1, bid_amount = $2, requirement_ids = $3, work_dates = $4, status = 'pending', updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [body.proposal, body.bid_amount, body.requirement_ids || [], body.work_dates || [], body.bid_id]
      );
      return NextResponse.json({ data: rows[0] });
    }

    // Create new bid (admin inviting member)
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_bids (project_id, member_id, proposal, bid_amount, estimated_days, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id, member_id) DO NOTHING
       RETURNING *`,
      [id, body.member_id, body.proposal || null, body.bid_amount || null, body.estimated_days || null, body.status || 'invited']
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { bid_id, status } = await req.json();

    if (!bid_id || !status) return NextResponse.json({ error: 'bid_id and status required' }, { status: 400 });

    const { rows } = await pool.query(
      `UPDATE gcc_world.project_bids SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, bid_id]
    );
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
