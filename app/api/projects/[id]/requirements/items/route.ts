import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function checkItemPermission(user: any, requirementId: number, projectId: string): Promise<string | null> {
  const { rows: [proj] } = await pool.query(`SELECT status FROM gcc_world.projects WHERE id = $1`, [projectId]);
  if (['review', 'completed', 'cancelled', 'closed'].includes(proj?.status)) {
    return 'No se pueden modificar tareas en el estado actual del proyecto';
  }

  if (proj?.status === 'in_progress' && user.role !== 'admin') {
    // Only the assigned member can modify sub-items of their requirement
    const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
    if (u?.member_id) {
      const { rows } = await pool.query(
        `SELECT 1 FROM gcc_world.requirement_assignments WHERE requirement_id = $1 AND member_id = $2 AND status = 'accepted' LIMIT 1`,
        [requirementId, u.member_id]
      );
      if (rows.length === 0) {
        // Check if user is project creator
        await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS created_by_user_id TEXT`);
        const { rows: [p] } = await pool.query(`SELECT created_by_user_id, assigned_member_id FROM gcc_world.projects WHERE id = $1`, [projectId]);
        const isCreator = p?.created_by_user_id === user.userId || p?.assigned_member_id == u.member_id;
        if (!isCreator) return 'Solo el miembro asignado a este requerimiento puede modificar sus tareas';
      }
    }
  }
  return null;
}

async function getReqProjectId(requirementId: number): Promise<string | null> {
  const { rows: [r] } = await pool.query(`SELECT project_id FROM gcc_world.project_requirements WHERE id = $1`, [requirementId]);
  return r?.project_id || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { requirement_id, title } = await req.json();

    if (!requirement_id || !title) return NextResponse.json({ error: 'requirement_id and title required' }, { status: 400 });

    const err = await checkItemPermission(user, requirement_id, id);
    if (err) return NextResponse.json({ error: err }, { status: 403 });

    const maxOrder = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM gcc_world.requirement_items WHERE requirement_id = $1`, [requirement_id]
    );

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.requirement_items (requirement_id, title, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [requirement_id, title, maxOrder.rows[0].next]
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
    const { id } = await params;
    const body = await req.json();

    // Reorder
    if (body.ordered_ids && body.requirement_id) {
      const err = await checkItemPermission(user, body.requirement_id, id);
      if (err) return NextResponse.json({ error: err }, { status: 403 });

      for (let i = 0; i < body.ordered_ids.length; i++) {
        await pool.query(`UPDATE gcc_world.requirement_items SET sort_order = $1 WHERE id = $2`, [i, body.ordered_ids[i]]);
      }
      return NextResponse.json({ message: 'Reordered' });
    }

    // Toggle complete or edit title
    if (body.item_id) {
      // Get requirement_id from item to check permission
      const { rows: [item] } = await pool.query(`SELECT requirement_id FROM gcc_world.requirement_items WHERE id = $1`, [body.item_id]);
      if (item) {
        const err = await checkItemPermission(user, item.requirement_id, id);
        if (err) return NextResponse.json({ error: err }, { status: 403 });
      }

      if (body.is_completed !== undefined) {
        await pool.query(
          `UPDATE gcc_world.requirement_items SET is_completed = $1, completed_at = $2, updated_at = NOW() WHERE id = $3`,
          [body.is_completed, body.is_completed ? new Date() : null, body.item_id]
        );
      }
      if (body.title !== undefined) {
        await pool.query(`UPDATE gcc_world.requirement_items SET title = $1, updated_at = NOW() WHERE id = $2`, [body.title, body.item_id]);
      }
      const { rows } = await pool.query(`SELECT * FROM gcc_world.requirement_items WHERE id = $1`, [body.item_id]);
      return NextResponse.json({ data: rows[0] });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { item_id } = await req.json();

    // Get requirement_id to check permission
    const { rows: [item] } = await pool.query(`SELECT requirement_id FROM gcc_world.requirement_items WHERE id = $1`, [item_id]);
    if (item) {
      const err = await checkItemPermission(user, item.requirement_id, id);
      if (err) return NextResponse.json({ error: err }, { status: 403 });
    }

    await pool.query(`DELETE FROM gcc_world.requirement_items WHERE id = $1`, [item_id]);
    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
