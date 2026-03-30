import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.project_requests (
      id SERIAL PRIMARY KEY,
      project_id INT NOT NULL,
      member_id INT NOT NULL,
      type VARCHAR(30) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(30) DEFAULT 'pending',
      reviewed_by TEXT,
      review_note TEXT,
      fee_amount NUMERIC(12,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function removeMemberFromProject(projectId: string, memberId: number) {
  // Remove requirement assignments
  await pool.query(
    `DELETE FROM gcc_world.requirement_assignments WHERE project_id = $1 AND member_id = $2`,
    [projectId, memberId]
  );
  // Update bid to rejected
  await pool.query(
    `UPDATE gcc_world.project_bids SET status = 'rejected', updated_at = NOW() WHERE project_id = $1 AND member_id = $2`,
    [projectId, memberId]
  );
  // Sync final cost
  await pool.query(
    `UPDATE gcc_world.projects SET final_cost = (
      SELECT COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), 0)
      FROM gcc_world.requirement_assignments ra
      WHERE ra.project_id = $1 AND ra.status = 'accepted'
    ), updated_at = NOW() WHERE id = $1`,
    [projectId]
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    await ensureTable();

    let query: string;
    const queryParams: any[] = [id];

    if (user.role === 'admin') {
      // Admin sees all requests for this project
      query = `SELECT pr.*, m.name as member_name, m.photo_url
               FROM gcc_world.project_requests pr
               JOIN gcc_world.members m ON m.id = pr.member_id
               WHERE pr.project_id = $1 ORDER BY pr.created_at DESC`;
    } else {
      // Members see only their own; project creator sees all
      const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);
      const { rows: [proj] } = await pool.query(`SELECT created_by_user_id, assigned_member_id FROM gcc_world.projects WHERE id = $1`, [id]);

      const isCreator = proj?.created_by_user_id === user.userId || (u?.member_id && proj?.assigned_member_id == u.member_id);

      if (isCreator) {
        query = `SELECT pr.*, m.name as member_name, m.photo_url
                 FROM gcc_world.project_requests pr
                 JOIN gcc_world.members m ON m.id = pr.member_id
                 WHERE pr.project_id = $1 ORDER BY pr.created_at DESC`;
      } else if (u?.member_id) {
        queryParams.push(u.member_id);
        query = `SELECT pr.*, m.name as member_name, m.photo_url
                 FROM gcc_world.project_requests pr
                 JOIN gcc_world.members m ON m.id = pr.member_id
                 WHERE pr.project_id = $1 AND pr.member_id = $2 ORDER BY pr.created_at DESC`;
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    const { rows } = await pool.query(query, queryParams);
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
    await ensureTable();

    const { type, reason } = await req.json();
    if (!type || !reason?.trim()) return NextResponse.json({ error: 'Tipo y motivo son requeridos' }, { status: 400 });
    if (!['withdrawal', 'supervised_exit'].includes(type)) return NextResponse.json({ error: 'Tipo invalido' }, { status: 400 });

    // Get member_id
    const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    if (!u?.member_id) return NextResponse.json({ error: 'Solo miembros pueden solicitar' }, { status: 403 });

    // Verify member is accepted participant
    const { rows: bids } = await pool.query(
      `SELECT 1 FROM gcc_world.project_bids WHERE project_id = $1 AND member_id = $2 AND status = 'accepted' LIMIT 1`,
      [id, u.member_id]
    );
    if (bids.length === 0) return NextResponse.json({ error: 'No eres participante activo de este proyecto' }, { status: 403 });

    // For supervised_exit: require a rejected withdrawal first
    if (type === 'supervised_exit') {
      const { rows: rejected } = await pool.query(
        `SELECT 1 FROM gcc_world.project_requests WHERE project_id = $1 AND member_id = $2 AND type = 'withdrawal' AND status = 'rejected' LIMIT 1`,
        [id, u.member_id]
      );
      if (rejected.length === 0) return NextResponse.json({ error: 'Debes tener un desistimiento rechazado para solicitar salida con supervision' }, { status: 400 });
    }

    // Check no pending request of same type
    const { rows: pending } = await pool.query(
      `SELECT 1 FROM gcc_world.project_requests WHERE project_id = $1 AND member_id = $2 AND type = $3 AND status = 'pending' LIMIT 1`,
      [id, u.member_id, type]
    );
    if (pending.length > 0) return NextResponse.json({ error: 'Ya tienes una solicitud pendiente de este tipo' }, { status: 400 });

    const { rows: [request] } = await pool.query(
      `INSERT INTO gcc_world.project_requests (project_id, member_id, type, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, u.member_id, type, reason.trim()]
    );

    return NextResponse.json({ data: request }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    await ensureTable();

    const { request_id, status, review_note, fee_amount } = await req.json();
    if (!request_id || !status) return NextResponse.json({ error: 'request_id y status requeridos' }, { status: 400 });

    // Get the request
    const { rows: [request] } = await pool.query(`SELECT * FROM gcc_world.project_requests WHERE id = $1 AND project_id = $2`, [request_id, id]);
    if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    if (request.status !== 'pending') return NextResponse.json({ error: 'Esta solicitud ya fue revisada' }, { status: 400 });

    // Permission check
    if (request.type === 'withdrawal') {
      // Only project creator can review withdrawals
      await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);
      const { rows: [proj] } = await pool.query(`SELECT created_by_user_id, assigned_member_id FROM gcc_world.projects WHERE id = $1`, [id]);
      const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
      const isCreator = user.role === 'admin' || proj?.created_by_user_id === user.userId || (u?.member_id && proj?.assigned_member_id == u.member_id);
      if (!isCreator) return NextResponse.json({ error: 'Solo el creador del proyecto puede revisar desistimientos' }, { status: 403 });
      if (!['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'Estado invalido para desistimiento' }, { status: 400 });
    } else if (request.type === 'supervised_exit') {
      // Only admin can review supervised exits
      if (user.role !== 'admin') return NextResponse.json({ error: 'Solo el administrador puede revisar salidas supervisadas' }, { status: 403 });
      if (!['exit_no_fee', 'exit_with_fee'].includes(status)) return NextResponse.json({ error: 'Estado invalido para salida supervisada' }, { status: 400 });
    }

    // Update request
    await pool.query(
      `UPDATE gcc_world.project_requests SET status = $1, reviewed_by = $2, review_note = $3, fee_amount = $4, updated_at = NOW() WHERE id = $5`,
      [status, user.userId, review_note || null, fee_amount || null, request_id]
    );

    // If approved/exit: remove member from project
    if (['approved', 'exit_no_fee', 'exit_with_fee'].includes(status)) {
      await removeMemberFromProject(id, request.member_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
