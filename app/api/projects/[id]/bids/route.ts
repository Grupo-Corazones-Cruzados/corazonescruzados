import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function ensureColumns() {
  await pool.query(`ALTER TABLE gcc_world.project_bids ADD COLUMN IF NOT EXISTS requirement_costs JSONB DEFAULT '{}'`);
}

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
    await ensureColumns();

    // Update existing bid (member submitting proposal)
    if (body.bid_id) {
      const { rows } = await pool.query(
        `UPDATE gcc_world.project_bids
         SET proposal = $1, bid_amount = $2, requirement_ids = $3, work_dates = $4, requirement_costs = $5, status = 'pending', updated_at = NOW()
         WHERE id = $6 RETURNING *`,
        [body.proposal, body.bid_amount, body.requirement_ids || [], body.work_dates || [], JSON.stringify(body.requirement_costs || {}), body.bid_id]
      );
      return NextResponse.json({ data: rows[0] });
    }

    // Create new bid
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_bids (project_id, member_id, proposal, bid_amount, estimated_days, requirement_ids, requirement_costs, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (project_id, member_id) DO NOTHING
       RETURNING *`,
      [id, body.member_id, body.proposal || null, body.bid_amount || null, body.estimated_days || null, body.requirement_ids || [], JSON.stringify(body.requirement_costs || {}), body.status || 'invited']
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id: projectId } = await params;
    const { bid_id, status } = await req.json();

    if (!bid_id || !status) return NextResponse.json({ error: 'bid_id and status required' }, { status: 400 });

    const { rows } = await pool.query(
      `UPDATE gcc_world.project_bids SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, bid_id]
    );

    const bid = rows[0];

    // When accepting a bid, auto-create requirement assignments
    if (status === 'accepted' && bid && bid.requirement_ids?.length > 0) {
      const costs = bid.requirement_costs || {};

      for (const reqId of bid.requirement_ids) {
        const cost = Number(costs[String(reqId)]) || 0;
        // Check if this member is already assigned to this requirement
        const existing = await pool.query(
          `SELECT 1 FROM gcc_world.requirement_assignments WHERE requirement_id = $1 AND member_id = $2 LIMIT 1`,
          [reqId, bid.member_id]
        );
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO gcc_world.requirement_assignments (project_id, requirement_id, member_id, proposed_cost, status)
             VALUES ($1, $2, $3, $4, 'accepted')`,
            [projectId, reqId, bid.member_id, cost]
          );
        }
      }

      // Sync final_cost
      await pool.query(
        `UPDATE gcc_world.projects SET final_cost = (
           SELECT COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), 0)
           FROM gcc_world.requirement_assignments ra
           WHERE ra.project_id = $1 AND ra.status = 'accepted'
         ), updated_at = NOW() WHERE id = $1`,
        [projectId]
      );
    }

    return NextResponse.json({ data: bid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
