import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { ensureIncidentTables, loadCategories, INCIDENT_SEVERITIES } from '@/lib/incidents/schema';

export const dynamic = 'force-dynamic';

/** Resuelve el proyecto a partir del token del portal público (revocable). */
async function projectByToken(token: string): Promise<{ id: number; title: string } | null> {
  if (!token || token.length < 16) return null;
  await ensureIncidentTables();
  const { rows } = await pool.query(
    `SELECT id, title FROM gcc_world.projects WHERE incidents_token = $1 LIMIT 1`,
    [token],
  );
  return rows[0] ? { id: Number(rows[0].id), title: rows[0].title } : null;
}

/** Portal público: proyecto + incidentes + catálogo. Sin login (token en la URL). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const project = await projectByToken(token);
    if (!project) return NextResponse.json({ error: 'Enlace inválido o revocado' }, { status: 403 });

    const { rows } = await pool.query(
      `SELECT id, title, severity, status, category, subcategory, reporter_name,
              created_at, updated_at, COALESCE(array_length(images, 1), 0) AS image_count
         FROM gcc_world.project_incidents
        WHERE project_id = $1 ORDER BY created_at DESC`,
      [project.id],
    );
    return NextResponse.json({
      project: { title: project.title },
      incidents: rows,
      categories: await loadCategories(project.id),
    });
  } catch (err: any) {
    console.error('Public incidents GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

function sanitizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter((s): s is string => typeof s === 'string' && s.startsWith('data:image/')).slice(0, 8);
}

/** Portal público: el cliente externo crea un incidente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const project = await projectByToken(token);
    if (!project) return NextResponse.json({ error: 'Enlace inválido o revocado' }, { status: 403 });

    const body = await req.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!title) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });

    const severity = INCIDENT_SEVERITIES.includes(body.severity) ? body.severity : 'medium';
    const category = body.category ? String(body.category).trim() : null;
    const subcategory = body.subcategory ? String(body.subcategory).trim() : null;
    const reporterName = body.reporter_name ? String(body.reporter_name).trim().slice(0, 120) : null;
    const images = sanitizeImages(body.images);

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.project_incidents
         (project_id, title, description, severity, status, images, category, subcategory, reporter_name)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
       RETURNING id, title, severity, status, category, subcategory, reporter_name, created_at, updated_at,
                 COALESCE(array_length(images, 1), 0) AS image_count`,
      [project.id, title, description, severity, images, category, subcategory, reporterName],
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Public incidents POST error:', err.message);
    return NextResponse.json({ error: 'Error al crear el incidente' }, { status: 500 });
  }
}
