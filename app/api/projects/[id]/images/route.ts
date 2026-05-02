import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const MAX_IMAGES = 30;

async function ensureImagesColumn() {
  await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS images TEXT[]`);
}

async function canManageImages(userId: string, userRole: string, projectId: string): Promise<boolean> {
  if (userRole === 'admin') return true;

  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  if (!u?.member_id) return false;

  const { rows: [project] } = await pool.query(
    `SELECT assigned_member_id FROM gcc_world.projects WHERE id = $1`, [projectId]
  );
  if (!project) return false;

  // Project creator
  if (String(project.assigned_member_id) === String(u.member_id)) return true;

  // Accepted participant
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.project_bids WHERE project_id = $1 AND member_id = $2 AND status = 'accepted' LIMIT 1`,
    [projectId, u.member_id]
  );
  return rows.length > 0;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureImagesColumn();

    const { rows: [project] } = await pool.query(
      `SELECT COALESCE(images, '{}') as images, status FROM gcc_world.projects WHERE id = $1`, [id]
    );
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ data: { images: project.images, status: project.status } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureImagesColumn();

    // Check project exists and is not in draft
    const { rows: [project] } = await pool.query(
      `SELECT status, COALESCE(images, '{}') as images FROM gcc_world.projects WHERE id = $1`, [id]
    );
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (project.status === 'draft') {
      return NextResponse.json({ error: 'El proyecto debe haber sido iniciado para subir imagenes' }, { status: 400 });
    }

    // Auth check
    const allowed = await canManageImages(user.userId, user.role, id);
    if (!allowed) return NextResponse.json({ error: 'No tienes permiso para subir imagenes a este proyecto' }, { status: 403 });

    const { images: newImages } = await req.json();
    if (!Array.isArray(newImages) || newImages.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron imagenes' }, { status: 400 });
    }

    const currentImages: string[] = project.images || [];
    if (currentImages.length + newImages.length > MAX_IMAGES) {
      return NextResponse.json({
        error: `Maximo ${MAX_IMAGES} imagenes por proyecto. Actualmente tienes ${currentImages.length}, intentas subir ${newImages.length}`,
      }, { status: 400 });
    }

    const combined = [...currentImages, ...newImages.filter((img: string) => img && img.trim())];

    await pool.query(
      `UPDATE gcc_world.projects SET images = $1, updated_at = NOW() WHERE id = $2`,
      [combined, id]
    );

    return NextResponse.json({ data: { images: combined, count: combined.length } });
  } catch (err: any) {
    console.error('Project images POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureImagesColumn();

    const { rows: [project] } = await pool.query(
      `SELECT status, COALESCE(images, '{}') as images FROM gcc_world.projects WHERE id = $1`, [id]
    );
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (project.status === 'draft') {
      return NextResponse.json({ error: 'El proyecto debe haber sido iniciado' }, { status: 400 });
    }

    const allowed = await canManageImages(user.userId, user.role, id);
    if (!allowed) return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });

    const { index } = await req.json();
    const currentImages: string[] = project.images || [];

    if (typeof index !== 'number' || index < 0 || index >= currentImages.length) {
      return NextResponse.json({ error: 'Indice de imagen invalido' }, { status: 400 });
    }

    const updated = currentImages.filter((_: string, i: number) => i !== index);

    await pool.query(
      `UPDATE gcc_world.projects SET images = $1, updated_at = NOW() WHERE id = $2`,
      [updated, id]
    );

    return NextResponse.json({ data: { images: updated, count: updated.length } });
  } catch (err: any) {
    console.error('Project images DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
