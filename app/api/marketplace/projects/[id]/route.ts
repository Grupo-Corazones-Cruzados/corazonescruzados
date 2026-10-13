import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { decodificarDataUri, guardar, quitar } from '@/lib/media';
import { NextRequest, NextResponse } from 'next/server';

async function ensureImagesColumn() {
  await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS images TEXT[]`);
}

async function isTeamMember(userId: string, projectId: string): Promise<boolean> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  if (!u?.member_id) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.project_bids WHERE project_id = $1 AND member_id = $2 AND status = 'accepted' LIMIT 1`,
    [projectId, u.member_id]
  );
  return rows.length > 0;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Lectura pública para el catálogo (imágenes del proyecto). Sin sesión solo se
    // devuelven proyectos publicados en el marketplace; con sesión, cualquiera por id.
    const user = await getCurrentUser();

    const { id } = await params;
    await ensureImagesColumn();

    const { rows: [project] } = await pool.query(
      `SELECT p.id, p.title, p.description, p.final_cost, p.is_marketplace_published,
              COALESCE(p.images, '{}') as images
       FROM gcc_world.projects p WHERE p.id = $1`,
      [id]
    );
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!user && !project.is_marketplace_published) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: project });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    await ensureImagesColumn();

    // Verify project is published
    const { rows: [project] } = await pool.query(
      `SELECT is_marketplace_published FROM gcc_world.projects WHERE id = $1`, [id]
    );
    if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!project.is_marketplace_published) return NextResponse.json({ error: 'Proyecto no publicado en marketplace' }, { status: 400 });

    // Auth: admin or accepted team member
    if (user.role !== 'admin') {
      const isMember = await isTeamMember(user.userId, id);
      if (!isMember) return NextResponse.json({ error: 'Solo miembros del equipo pueden editar' }, { status: 403 });
    }

    const { title, final_cost, images, tags } = await req.json();

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
    if (final_cost !== undefined) { fields.push(`final_cost = $${idx++}`); values.push(final_cost); }
    // Tags: con qué se hizo el proyecto. Distinto de los talentos de sus
    // requerimientos, que dicen quién puede hacerlo.
    if (tags !== undefined) {
      fields.push(`tags = $${idx++}`);
      values.push(Array.isArray(tags) ? tags.map((t: any) => String(t ?? '').trim()).filter(Boolean).slice(0, 12) : []);
    }
    // Aquí llega la lista ENTERA de fotos: las nuevas (data URL) van a Drive y las que ya no
    // están se mandan a la papelera de Drive después de guardar (2026-10-13).
    let quitadas: string[] = [];
    if (images !== undefined) {
      const { rows: [actual] } = await pool.query(
        `SELECT title, COALESCE(images, '{}') AS images FROM gcc_world.projects WHERE id = $1`, [id],
      );
      const antes: string[] = actual?.images || [];
      const cleanImages: string[] = [];
      for (const img of (images as string[]).filter((u) => u && u.trim())) {
        const d = decodificarDataUri(img);
        if (!d || !d.mime.startsWith('image/')) { cleanImages.push(img); continue; }
        const g = await guardar({
          datos: d.datos, mime: d.mime,
          base: `${actual?.title || `Proyecto ${id}`} · foto ${String(antes.length + cleanImages.length + 1).padStart(2, '0')}`,
          modulo: 'proyecto_foto', referencia: id, ruta: ['Proyectos', `${id} · ${actual?.title || ''}`.trim(), 'Fotos'],
        });
        cleanImages.push(g.url);
      }
      quitadas = antes.filter((x) => !cleanImages.includes(x));
      fields.push(`images = $${idx++}`);
      values.push(cleanImages);
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE gcc_world.projects SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
    for (const ref of quitadas) await quitar(ref).catch((e) => console.error('[marketplace] papelera de Drive', e?.message));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Marketplace project update error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
