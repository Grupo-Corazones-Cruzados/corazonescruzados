import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;

    // Ensure proforma column exists
    try { await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS proforma TEXT`); } catch { /* ignore */ }

    const { rows } = await pool.query(
      `SELECT p.*, c.name as client_name, c.email as client_email,
              m.name as assigned_member_name,
              (p.proforma IS NOT NULL) as has_proforma
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       LEFT JOIN gcc_world.members m ON m.id = p.assigned_member_id
       WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Access control: private projects or drafts require ownership/participation
    const project = rows[0];
    if ((project.is_private || project.status === 'draft') && user.role !== 'admin') {
      let hasAccess = false;

      if (user.role === 'member') {
        const memberRes = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
        const mId = memberRes.rows[0]?.member_id;
        if (mId) {
          // Owner?
          if (project.assigned_member_id == mId) hasAccess = true;
          // Invited/accepted?
          if (!hasAccess) {
            const bidRes = await pool.query(
              `SELECT 1 FROM gcc_world.project_bids WHERE project_id = $1 AND member_id = $2 LIMIT 1`, [id, mId]
            );
            if (bidRes.rows.length > 0) hasAccess = true;
          }
        }
      } else if (user.role === 'client') {
        const clientRes = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = LOWER($1) LIMIT 1`, [user.email]);
        if (clientRes.rows[0] && project.client_id == clientRes.rows[0].id) hasAccess = true;
      }

      if (!hasAccess) return NextResponse.json({ error: 'No tienes acceso a este proyecto privado' }, { status: 403 });
    }

    // Get requirements with assigned members and sub-items
    const reqs = await pool.query(
      `SELECT r.*, (r.completed_at IS NOT NULL) as is_completed,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', ra.id, 'member_id', ra.member_id, 'member_name', m.name, 'photo_url', m.photo_url,
                  'proposed_cost', ra.proposed_cost, 'member_cost', ra.member_cost, 'status', ra.status
                )) FROM gcc_world.requirement_assignments ra
                JOIN gcc_world.members m ON m.id = ra.member_id
                WHERE ra.requirement_id = r.id),
                '[]'::json
              ) as assignments,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', ri.id, 'title', ri.title, 'is_completed', ri.is_completed, 'sort_order', ri.sort_order
                ) ORDER BY ri.sort_order, ri.id) FROM gcc_world.requirement_items ri
                WHERE ri.requirement_id = r.id),
                '[]'::json
              ) as items
       FROM gcc_world.project_requirements r
       WHERE r.project_id = $1
       ORDER BY r.id`,
      [id]
    );

    // Get bids/participants
    const bids = await pool.query(
      `SELECT pb.*, m.name as member_name, m.email as member_email, m.photo_url
       FROM gcc_world.project_bids pb
       JOIN gcc_world.members m ON m.id = pb.member_id
       WHERE pb.project_id = $1
       ORDER BY pb.created_at`,
      [id]
    );

    // Get linked DigiMundo incidents if project is linked
    let incidents: any[] = [];
    if (rows[0].digimundo_project_id) {
      const incRes = await pool.query(
        `SELECT id, title, severity, status, "clientName", "createdAt", "updatedAt"
         FROM gcc_world."Incident"
         WHERE "projectId" = $1
         ORDER BY "createdAt" DESC`,
        [rows[0].digimundo_project_id]
      );
      incidents = incRes.rows;
    }

    return NextResponse.json({
      data: { ...rows[0], requirements: reqs.rows, bids: bids.rows, incidents },
    });
  } catch (err: any) {
    console.error('Project GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // Get current project state
    const { rows: [current] } = await pool.query(`SELECT status, is_private FROM gcc_world.projects WHERE id = $1`, [id]);
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Validate status transitions
    const VALID_TRANSITIONS: Record<string, string[]> = {
      draft: ['open', 'cancelled'], open: ['in_progress', 'cancelled'], in_progress: ['review', 'cancelled'], review: ['completed'],
    };
    if (body.status && body.status !== current.status) {
      const allowed = VALID_TRANSITIONS[current.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: `No se puede cambiar de ${current.status} a ${body.status}` }, { status: 400 });
      }
      // review → completed: only admin
      if (body.status === 'completed' && user.role !== 'admin') {
        return NextResponse.json({ error: 'Solo el administrador puede completar proyectos' }, { status: 403 });
      }
      // in_progress → review: require 100% completion
      if (body.status === 'review') {
        const { rows: reqs } = await pool.query(
          `SELECT id, completed_at FROM gcc_world.project_requirements WHERE project_id = $1`, [id]
        );
        if (reqs.length === 0) return NextResponse.json({ error: 'No hay requerimientos en el proyecto' }, { status: 400 });
        const incomplete = reqs.filter((r: any) => !r.completed_at);
        if (incomplete.length > 0) return NextResponse.json({ error: 'Todos los requerimientos deben estar completados para enviar a revision' }, { status: 400 });
        // Force private on review
        body.is_private = true;
      }
    }

    // Validate visibility changes
    if (body.is_private !== undefined && body.is_private !== current.is_private) {
      if (current.status === 'draft') return NextResponse.json({ error: 'No se puede cambiar la visibilidad en borrador' }, { status: 400 });
      if (current.status === 'review') return NextResponse.json({ error: 'No se puede cambiar la visibilidad en revision' }, { status: 400 });
      // Only allow changing visibility if there are unassigned requirements
      if (!body.is_private) { // trying to make public
        const { rows: [unassigned] } = await pool.query(
          `SELECT COUNT(*) as cnt FROM gcc_world.project_requirements r
           WHERE r.project_id = $1 AND NOT EXISTS (
             SELECT 1 FROM gcc_world.requirement_assignments ra WHERE ra.requirement_id = r.id AND ra.status = 'accepted'
           )`, [id]
        );
        if (Number(unassigned.cnt) === 0) return NextResponse.json({ error: 'No hay requerimientos sin asignar, no es necesario hacer publico' }, { status: 400 });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(body)) {
      if (['title', 'description', 'status', 'budget_min', 'budget_max', 'final_cost', 'deadline', 'is_private', 'assigned_member_id', 'confirmed_at', 'digimundo_project_id', 'proforma'].includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE gcc_world.projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Project PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await pool.query('DELETE FROM gcc_world.projects WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('Project DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
