import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Requerimientos (solo lectura) de un proyecto del marketplace. Endpoint LIGERO,
 * separado de las imágenes (que son base64 pesadas): el panel de detalle los pide
 * aparte para que aparezcan al instante sin esperar a que bajen las imágenes.
 * Lectura pública solo para proyectos publicados; con sesión, cualquiera por id.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    const { rows: [proj] } = await pool.query(
      `SELECT is_marketplace_published FROM gcc_world.projects WHERE id = $1`,
      [id]
    );
    if (!proj) return NextResponse.json({ data: [] }, { status: 404 });
    if (!user && !proj.is_marketplace_published) return NextResponse.json({ data: [] }, { status: 404 });

    const { rows } = await pool.query(
      `SELECT r.id, r.title, r.description, (r.completed_at IS NOT NULL) as is_completed,
              COALESCE(
                (SELECT json_agg(json_build_object('id', ra.id, 'member_name', m.name, 'photo_url', m.photo_url)
                        ORDER BY ra.id)
                 FROM gcc_world.requirement_assignments ra
                 JOIN gcc_world.members m ON m.id = ra.member_id
                 WHERE ra.requirement_id = r.id AND ra.status = 'accepted'),
                '[]'::json
              ) as assignments
       FROM gcc_world.project_requirements r
       WHERE r.project_id = $1
       ORDER BY r.id`,
      [id]
    );
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
