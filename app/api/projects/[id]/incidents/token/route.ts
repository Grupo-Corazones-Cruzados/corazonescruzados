import { pool } from '@/lib/db';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { loadProjectForIncidents, canManageProjectIncidents } from '@/lib/incidents/schema';

export const dynamic = 'force-dynamic';

/**
 * Genera (o devuelve) el token revocable del portal público de incidentes del proyecto.
 * Body opcional { regenerate: true } fuerza un token nuevo (invalida el anterior).
 * Solo responsable/admin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (!(await canManageProjectIncidents(user, project))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let token = project.incidents_token;
    if (!token || body.regenerate) {
      token = crypto.randomBytes(32).toString('hex');
      await pool.query(`UPDATE gcc_world.projects SET incidents_token = $1 WHERE id = $2`, [token, project.id]);
    }
    return NextResponse.json({ token });
  } catch (err: any) {
    console.error('Incidents token POST error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/** Revoca el token (deshabilita el portal público). Solo responsable/admin. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (!(await canManageProjectIncidents(user, project))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await pool.query(`UPDATE gcc_world.projects SET incidents_token = NULL WHERE id = $1`, [project.id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Incidents token DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
