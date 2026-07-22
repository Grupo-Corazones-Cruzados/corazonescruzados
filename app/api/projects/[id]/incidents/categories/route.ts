import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureIncidentTables, loadProjectForIncidents, canManageProjectIncidents, loadCategories,
} from '@/lib/incidents/schema';

export const dynamic = 'force-dynamic';

/** Catálogo de categorías → subcategorías del proyecto. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    return NextResponse.json({ categories: await loadCategories(project.id) });
  } catch (err: any) {
    console.error('Incident categories GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/**
 * Reemplaza el catálogo completo (categorías + subcategorías) del proyecto.
 * Body: { categories: [{ name, subcategories: [{ name }] }] }. Solo responsable/admin.
 * Los incidentes guardan la categoría por NOMBRE, así que reordenar/renombrar el catálogo
 * no afecta a los incidentes ya creados.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    if (!(await canManageProjectIncidents(user, project))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { categories } = await req.json();
    if (!Array.isArray(categories)) return NextResponse.json({ error: 'categories requerido' }, { status: 400 });

    await ensureIncidentTables();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM gcc_world.project_incident_categories WHERE project_id = $1`, [project.id]);
      let ci = 0;
      for (const cat of categories) {
        const name = String(cat?.name || '').trim();
        if (!name) continue;
        const { rows } = await client.query(
          `INSERT INTO gcc_world.project_incident_categories (project_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
          [project.id, name, ci++],
        );
        const catId = rows[0].id;
        const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
        let si = 0;
        for (const sub of subs) {
          const sname = String(sub?.name || '').trim();
          if (!sname) continue;
          await client.query(
            `INSERT INTO gcc_world.project_incident_subcategories (category_id, name, sort_order) VALUES ($1, $2, $3)`,
            [catId, sname, si++],
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ categories: await loadCategories(project.id) });
  } catch (err: any) {
    console.error('Incident categories PUT error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
