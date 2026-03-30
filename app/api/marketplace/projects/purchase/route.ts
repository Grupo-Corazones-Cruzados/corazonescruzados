import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { source_project_id } = await req.json();
    if (!source_project_id) return NextResponse.json({ error: 'source_project_id requerido' }, { status: 400 });

    // Ensure columns exist
    await client.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS is_marketplace_published BOOLEAN DEFAULT false;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS marketplace_source_id BIGINT;
    `);

    // Verify source project is published
    const { rows: [source] } = await client.query(
      `SELECT id, title, description, final_cost, is_marketplace_published
       FROM gcc_world.projects WHERE id = $1`,
      [source_project_id]
    );
    if (!source) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (!source.is_marketplace_published) return NextResponse.json({ error: 'Proyecto no disponible en marketplace' }, { status: 400 });

    // Resolve client_id for the buyer
    let clientId: number | null = null;
    if (user.role === 'client') {
      const { rows: [c] } = await client.query(
        `SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [user.email]
      );
      if (c) {
        clientId = c.id;
      } else {
        const { rows: [u] } = await client.query(
          `SELECT first_name, last_name, email FROM gcc_world.users WHERE id = $1`, [user.userId]
        );
        const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.email;
        const { rows: [newC] } = await client.query(
          `INSERT INTO gcc_world.clients (name, email) VALUES ($1, $2) RETURNING id`, [name, u.email]
        );
        clientId = newC.id;
      }
    }

    await client.query('BEGIN');

    // 1. Clone project
    const { rows: [newProject] } = await client.query(
      `INSERT INTO gcc_world.projects (title, description, budget_min, budget_max, status, is_private, marketplace_source_id, client_id)
       VALUES ($1, $2, $3, $3, 'draft', true, $4, $5) RETURNING id`,
      [source.title, source.description, source.final_cost || 0, source.id, clientId]
    );
    const newProjectId = newProject.id;

    // 2. Clone requirements and build ID mapping
    const { rows: sourceReqs } = await client.query(
      `SELECT id, title, description, cost FROM gcc_world.project_requirements WHERE project_id = $1 ORDER BY id`,
      [source_project_id]
    );

    const reqIdMap: Record<number, number> = {};
    for (const req of sourceReqs) {
      const { rows: [newReq] } = await client.query(
        `INSERT INTO gcc_world.project_requirements (project_id, title, description, cost)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [newProjectId, req.title, req.description, req.cost]
      );
      reqIdMap[req.id] = newReq.id;

      // 3. Clone requirement items
      const { rows: items } = await client.query(
        `SELECT title, sort_order FROM gcc_world.requirement_items WHERE requirement_id = $1 ORDER BY sort_order, id`,
        [req.id]
      );
      for (const item of items) {
        await client.query(
          `INSERT INTO gcc_world.requirement_items (requirement_id, title, is_completed, sort_order)
           VALUES ($1, $2, false, $3)`,
          [newReq.id, item.title, item.sort_order]
        );
      }
    }

    // 4. Get accepted members from original project
    const { rows: acceptedBids } = await client.query(
      `SELECT member_id FROM gcc_world.project_bids WHERE project_id = $1 AND status = 'accepted'`,
      [source_project_id]
    );

    // Create invitations for each member
    for (const bid of acceptedBids) {
      await client.query(
        `INSERT INTO gcc_world.project_bids (project_id, member_id, status)
         VALUES ($1, $2, 'invited') ON CONFLICT (project_id, member_id) DO NOTHING`,
        [newProjectId, bid.member_id]
      );
    }

    // 5. Clone requirement assignments (map old req IDs to new ones)
    const { rows: sourceAssignments } = await client.query(
      `SELECT requirement_id, member_id, proposed_cost, member_cost
       FROM gcc_world.requirement_assignments
       WHERE project_id = $1 AND status = 'accepted'`,
      [source_project_id]
    );

    for (const assign of sourceAssignments) {
      const newReqId = reqIdMap[assign.requirement_id];
      if (!newReqId) continue;
      await client.query(
        `INSERT INTO gcc_world.requirement_assignments (requirement_id, project_id, member_id, proposed_cost, member_cost, status)
         VALUES ($1, $2, $3, $4, $5, 'proposed')`,
        [newReqId, newProjectId, assign.member_id, assign.proposed_cost, assign.member_cost]
      );
    }

    await client.query('COMMIT');

    return NextResponse.json({ data: { project_id: newProjectId } }, { status: 201 });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Marketplace purchase error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
