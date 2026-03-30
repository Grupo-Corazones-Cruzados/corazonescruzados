import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function syncFinalCost(projectId: string) {
  // Final cost = sum of accepted assignment costs (member_cost if counter accepted, else proposed_cost)
  await pool.query(
    `UPDATE gcc_world.projects SET final_cost = (
      SELECT COALESCE(SUM(COALESCE(ra.member_cost, ra.proposed_cost)), 0)
      FROM gcc_world.requirement_assignments ra
      WHERE ra.project_id = $1 AND ra.status = 'accepted'
    ), updated_at = NOW() WHERE id = $1`,
    [projectId]
  );
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
    if (proj?.status === 'completed') return NextResponse.json({ error: 'No se pueden agregar requerimientos a un proyecto completado' }, { status: 400 });

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
    const { requirement_id, completed, title, description, cost } = await req.json();

    if (!requirement_id) return NextResponse.json({ error: 'requirement_id required' }, { status: 400 });

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

    // Sync final_cost if cost changed
    if (cost !== undefined) {
      const { id } = await params;
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
    if (proj?.status === 'completed') return NextResponse.json({ error: 'No se pueden eliminar requerimientos de un proyecto completado' }, { status: 400 });

    const { requirement_id } = await req.json();

    // Clean up pending bids that only covered this requirement
    await pool.query(
      `UPDATE gcc_world.project_bids SET status = 'invited', requirement_ids = '{}'
       WHERE project_id = $1 AND status = 'pending' AND requirement_ids = ARRAY[$2]::bigint[]`,
      [id, requirement_id]
    );
    // Remove this requirement from any bid's requirement_ids
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
