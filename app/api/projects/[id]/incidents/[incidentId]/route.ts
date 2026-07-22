import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  loadProjectForIncidents, canManageProjectIncidents,
  INCIDENT_SEVERITIES, INCIDENT_STATUSES,
} from '@/lib/incidents/schema';

export const dynamic = 'force-dynamic';

/** Detalle completo de un incidente (incluye imágenes). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; incidentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id, incidentId } = await params;
    const { rows } = await pool.query(
      `SELECT * FROM gcc_world.project_incidents WHERE id = $1 AND project_id = $2`,
      [incidentId, id],
    );
    if (!rows[0]) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Incident GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/** Edita un incidente (estado, contenido, imágenes). Solo el responsable/admin. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; incidentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, incidentId } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (!(await canManageProjectIncidents(user, project))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;
    const push = (col: string, val: any) => { sets.push(`${col} = $${i++}`); values.push(val); };

    if (typeof body.status === 'string' && INCIDENT_STATUSES.includes(body.status)) push('status', body.status);
    if (typeof body.severity === 'string' && INCIDENT_SEVERITIES.includes(body.severity)) push('severity', body.severity);
    if (typeof body.title === 'string' && body.title.trim()) push('title', body.title.trim());
    if (typeof body.description === 'string') push('description', body.description);
    if ('category' in body) push('category', body.category ? String(body.category).trim() : null);
    if ('subcategory' in body) push('subcategory', body.subcategory ? String(body.subcategory).trim() : null);
    if (Array.isArray(body.images)) {
      push('images', body.images.filter((s: any) => typeof s === 'string' && s.startsWith('data:image/')).slice(0, 8));
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });

    values.push(incidentId, project.id);
    const { rows } = await pool.query(
      `UPDATE gcc_world.project_incidents SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${i++} AND project_id = $${i} RETURNING *`,
      values,
    );
    if (!rows[0]) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Incident PATCH error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/** Borra un incidente. Solo el responsable/admin. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; incidentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, incidentId } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (!(await canManageProjectIncidents(user, project))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await pool.query(`DELETE FROM gcc_world.project_incidents WHERE id = $1 AND project_id = $2`, [incidentId, project.id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Incident DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
