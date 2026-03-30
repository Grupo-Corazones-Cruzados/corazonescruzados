import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function syncFinalCost(projectId: string) {
  await pool.query(
    `UPDATE gcc_world.projects SET final_cost = (
      SELECT COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), 0)
      FROM gcc_world.requirement_assignments ra
      WHERE ra.project_id = $1 AND ra.status = 'accepted'
    ), updated_at = NOW() WHERE id = $1`,
    [projectId]
  );
}

async function getUserMemberId(userId: string): Promise<number | null> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  return u?.member_id || null;
}

async function isProjectCreator(userId: string, projectId: string): Promise<boolean> {
  await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);
  const { rows: [p] } = await pool.query(`SELECT created_by_user_id, assigned_member_id FROM gcc_world.projects WHERE id = $1`, [projectId]);
  if (p?.created_by_user_id === userId) return true;
  // Fallback: check if user's member_id matches assigned_member_id
  const memberId = await getUserMemberId(userId);
  return memberId != null && p?.assigned_member_id == memberId;
}

async function getReqOwnerMemberId(requirementId: number): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT member_id FROM gcc_world.requirement_assignments WHERE requirement_id = $1 AND status = 'accepted' LIMIT 1`,
    [requirementId]
  );
  return rows[0]?.member_id || null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT *, (completed_at IS NOT NULL) as is_completed FROM gcc_world.project_requirements WHERE project_id = $1 ORDER BY id`,
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

    const { rows: [proj] } = await pool.query(`SELECT status FROM gcc_world.projects WHERE id = $1`, [id]);
    if (['review', 'completed', 'cancelled', 'closed'].includes(proj?.status)) {
      return NextResponse.json({ error: 'No se pueden agregar requerimientos en el estado actual' }, { status: 400 });
    }

    // In in_progress: only creator or admin can create requirements
    if (proj?.status === 'in_progress' && user.role !== 'admin') {
      const isCreator = await isProjectCreator(user.userId, id);
      if (!isCreator) return NextResponse.json({ error: 'Solo el creador del proyecto puede agregar requerimientos' }, { status: 403 });
    }

    const { title, description, cost } = await req.json();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_requirements (project_id, title, description, cost)
       VALUES ($1, $2, $3, $4) RETURNING *, (completed_at IS NOT NULL) as is_completed`,
      [id, title, description || null, cost || null]
    );
    await syncFinalCost(id);
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { requirement_id, completed, title, description, cost } = await req.json();

    if (!requirement_id) return NextResponse.json({ error: 'requirement_id required' }, { status: 400 });

    const { rows: [proj] } = await pool.query(`SELECT status FROM gcc_world.projects WHERE id = $1`, [id]);
    if (['review', 'completed', 'cancelled', 'closed'].includes(proj?.status)) {
      return NextResponse.json({ error: 'No se pueden editar requerimientos en el estado actual' }, { status: 400 });
    }

    // Permission check in in_progress
    if (proj?.status === 'in_progress' && user.role !== 'admin') {
      const ownerMemberId = await getReqOwnerMemberId(requirement_id);
      const userMemberId = await getUserMemberId(user.userId);
      const isCreator = await isProjectCreator(user.userId, id);

      if (ownerMemberId) {
        // Requirement has an owner
        if (userMemberId != ownerMemberId) {
          // Not the owner — creator can only view, other participants can't edit
          return NextResponse.json({ error: 'Solo el miembro asignado puede editar este requerimiento' }, { status: 403 });
        }
        // Owner can edit/complete their own requirement
      } else if (!isCreator) {
        // Unassigned req — only creator can edit
        return NextResponse.json({ error: 'Solo el creador del proyecto puede editar requerimientos no asignados' }, { status: 403 });
      }
    }

    if (completed !== undefined) {
      await pool.query(
        `UPDATE gcc_world.project_requirements SET completed_at = $1, updated_at = NOW() WHERE id = $2`,
        [completed ? new Date() : null, requirement_id]
      );
    }
    if (title !== undefined) {
      await pool.query(`UPDATE gcc_world.project_requirements SET title = $1, updated_at = NOW() WHERE id = $2`, [title, requirement_id]);
    }
    if (description !== undefined) {
      await pool.query(`UPDATE gcc_world.project_requirements SET description = $1, updated_at = NOW() WHERE id = $2`, [description, requirement_id]);
    }
    if (cost !== undefined) {
      await pool.query(`UPDATE gcc_world.project_requirements SET cost = $1, updated_at = NOW() WHERE id = $2`, [cost, requirement_id]);
    }

    if (cost !== undefined) {
      await syncFinalCost(id);
    }

    const { rows } = await pool.query(
      `SELECT *, (completed_at IS NOT NULL) as is_completed FROM gcc_world.project_requirements WHERE id = $1`, [requirement_id]
    );
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { rows: [proj] } = await pool.query(`SELECT status FROM gcc_world.projects WHERE id = $1`, [id]);
    if (['review', 'completed', 'cancelled', 'closed'].includes(proj?.status)) {
      return NextResponse.json({ error: 'No se pueden eliminar requerimientos en el estado actual' }, { status: 400 });
    }

    const { requirement_id } = await req.json();

    // In in_progress: cannot delete requirements that have an assigned owner
    if (proj?.status === 'in_progress') {
      const ownerMemberId = await getReqOwnerMemberId(requirement_id);
      if (ownerMemberId) {
        return NextResponse.json({ error: 'No se puede eliminar un requerimiento que ya tiene un miembro asignado' }, { status: 400 });
      }
    }

    await pool.query(
      `UPDATE gcc_world.project_bids SET status = 'invited', requirement_ids = '{}'
       WHERE project_id = $1 AND status = 'pending' AND requirement_ids = ARRAY[$2]::bigint[]`,
      [id, requirement_id]
    );
    await pool.query(
      `UPDATE gcc_world.project_bids SET requirement_ids = array_remove(requirement_ids, $1)
       WHERE project_id = $2 AND $1 = ANY(requirement_ids)`,
      [requirement_id, id]
    );

    await pool.query(`DELETE FROM gcc_world.requirement_items WHERE requirement_id = $1`, [requirement_id]);
    await pool.query(`DELETE FROM gcc_world.requirement_assignments WHERE requirement_id = $1`, [requirement_id]);
    await pool.query(`DELETE FROM gcc_world.project_requirements WHERE id = $1`, [requirement_id]);
    await syncFinalCost(id);
    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
