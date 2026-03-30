import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 15);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    // Access control: private projects only visible to owner, invited members, or admin
    if (user.role === 'member') {
      const memberRes = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      const mId = memberRes.rows[0]?.member_id;
      if (mId) {
        params.push(mId);
        const mIdx = params.length;
        where += ` AND ((p.is_private = false AND p.status != 'draft') OR p.assigned_member_id = $${mIdx} OR EXISTS (SELECT 1 FROM gcc_world.project_bids pb WHERE pb.project_id = p.id AND pb.member_id = $${mIdx}))`;

        // Handle special tabs
        if (status === 'mine') {
          where += ` AND p.assigned_member_id = $${mIdx}`;
        } else if (status === 'invited') {
          where += ` AND EXISTS (SELECT 1 FROM gcc_world.project_bids pb2 WHERE pb2.project_id = p.id AND pb2.member_id = $${mIdx} AND pb2.status = 'invited')`;
        }
      }
    } else if (user.role === 'client') {
      const clientRes = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [user.email]);
      if (clientRes.rows[0]) {
        params.push(clientRes.rows[0].id);
        where += ` AND p.client_id = $${params.length}`;
      }
    }
    // admin sees everything

    if (status && status !== 'all' && status !== 'mine' && status !== 'invited') {
      params.push(status);
      where += ` AND p.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND p.title ILIKE $${params.length}`;
    }

    const countQ = await pool.query(`SELECT COUNT(*) FROM gcc_world.projects p ${where}`, params);
    params.push(limit, offset);

    // Ensure invoice_projects table exists for the LEFT JOINs
    await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.invoice_projects (
      id SERIAL PRIMARY KEY, invoice_id INT NOT NULL, project_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    const dataQ = await pool.query(
      `SELECT p.*, c.name as client_name,
              inv_info.invoice_id,
              inv_info.invoice_sri_status
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       LEFT JOIN LATERAL (
         SELECT id as invoice_id, sri_status as invoice_sri_status
         FROM gcc_world.invoices
         WHERE project_id = p.id AND status != 'cancelled'
         UNION ALL
         SELECT ip.invoice_id, i.sri_status
         FROM gcc_world.invoice_projects ip
         JOIN gcc_world.invoices i ON i.id = ip.invoice_id AND i.status != 'cancelled'
         WHERE ip.project_id = CAST(p.id AS TEXT)
         LIMIT 1
       ) inv_info ON true
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return NextResponse.json({ data: dataQ.rows, total: Number(countQ.rows[0].count) });
  } catch (err: any) {
    console.error('Projects error:', err.message);
    return NextResponse.json({ data: [], total: 0 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    // Ensure created_by_user_id column exists
    await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);

    let clientId = body.client_id || null;
    // All roles: always start as draft + private
    const status = 'draft';
    const isPrivate = true;

    // Resolve assigned_member_id for members
    let assignedMemberId = body.assigned_member_id || null;
    if (user.role === 'member') {
      const memberRes = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      const memberId = memberRes.rows[0]?.member_id;
      if (!memberId) return NextResponse.json({ error: 'No member profile' }, { status: 400 });
      assignedMemberId = memberId;

      // Handle client_email → find/create client
      if (body.client_email && !clientId) {
        const existing = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [body.client_email]);
        if (existing.rows[0]) {
          clientId = existing.rows[0].id;
        } else {
          const ins = await pool.query(
            `INSERT INTO gcc_world.clients (name, email) VALUES ($1, $2) RETURNING id`,
            [body.client_email, body.client_email.toLowerCase()]
          );
          clientId = ins.rows[0].id;
        }
      }
    }

    // Client role: auto-resolve client_id from email
    if (user.role === 'client' && !clientId) {
      const clientRes = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [user.email]);
      if (clientRes.rows[0]) {
        clientId = clientRes.rows[0].id;
      } else {
        const userRes = await pool.query(`SELECT first_name, last_name, email, phone FROM gcc_world.users WHERE id = $1`, [user.userId]);
        const u = userRes.rows[0];
        const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email;
        const ins = await pool.query(`INSERT INTO gcc_world.clients (name, email, phone) VALUES ($1, $2, $3) RETURNING id`, [name, u.email, u.phone]);
        clientId = ins.rows[0].id;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.projects (client_id, assigned_member_id, title, description, budget_min, budget_max, deadline, status, is_private, final_cost, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [clientId, assignedMemberId, body.title, body.description || null, body.budget_min || null, body.budget_max || null, body.deadline || null, status, isPrivate, body.final_cost || null, user.userId]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Projects POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
