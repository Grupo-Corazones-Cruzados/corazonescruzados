import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureIncidentTables, loadProjectForIncidents, canManageProjectIncidents,
  loadCategories, INCIDENT_SEVERITIES,
} from '@/lib/incidents/schema';

export const dynamic = 'force-dynamic';

/** Lista de incidentes del proyecto + catálogo de categorías + token + permiso de gestión. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const { rows } = await pool.query(
      `SELECT id, title, severity, status, category, subcategory, reporter_name,
              created_at, updated_at, COALESCE(array_length(images, 1), 0) AS image_count
         FROM gcc_world.project_incidents
        WHERE project_id = $1 ORDER BY created_at DESC`,
      [project.id],
    );
    const categories = await loadCategories(project.id);
    const canManage = await canManageProjectIncidents(user, project);

    return NextResponse.json({
      incidents: rows,
      categories,
      token: canManage ? project.incidents_token : null,
      canManage,
    });
  } catch (err: any) {
    console.error('Incidents GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

/** Sanea imágenes: solo data-URIs de imagen; máximo 8. */
function sanitizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((s): s is string => typeof s === 'string' && s.startsWith('data:image/'))
    .slice(0, 8);
}

/** Crea un incidente (cualquier usuario autenticado con acceso al proyecto). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const project = await loadProjectForIncidents(id);
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const body = await req.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!title) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });

    const severity = INCIDENT_SEVERITIES.includes(body.severity) ? body.severity : 'medium';
    const category = body.category ? String(body.category).trim() : null;
    const subcategory = body.subcategory ? String(body.subcategory).trim() : null;
    const reporterName = body.reporter_name ? String(body.reporter_name).trim().slice(0, 120) : null;
    const images = sanitizeImages(body.images);

    await ensureIncidentTables();
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_incidents
         (project_id, title, description, severity, status, images, category, subcategory, reporter_name, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)
       RETURNING id, title, severity, status, category, subcategory, reporter_name, created_at, updated_at,
                 COALESCE(array_length(images, 1), 0) AS image_count`,
      [project.id, title, description, severity, images, category, subcategory, reporterName, user.userId || null],
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Incidents POST error:', err.message);
    return NextResponse.json({ error: 'Error al crear el incidente' }, { status: 500 });
  }
}
