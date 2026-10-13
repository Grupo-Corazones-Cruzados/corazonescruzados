import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { decodificarDataUri, guardar, nombresDe, quitar } from '@/lib/media';
import { puedeGestionarImagenes } from '@/lib/projects/permisos';

const MAX_IMAGES = 30;

async function ensureImagesColumn() {
  await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS images TEXT[]`);
}

/** La regla vive en lib/projects/permisos.ts (la usa también el renombrado de /api/media). */
function canManageImages(userId: string, userRole: string, projectId: string): Promise<boolean> {
  return puedeGestionarImagenes({ userId, role: userRole }, projectId);
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

    // `nombres`: { fileId: nombre } de las que viven en Drive, para mostrarlas y renombrarlas.
    return NextResponse.json({ data: { images: project.images, status: project.status, nombres: await nombresDe(project.images) } });
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

    // A Drive (2026-10-13), ya no a Cloudinary ni a la base. Se sube de una en una y cada
    // una se comprueba por md5; si alguna falla, las ya subidas se quedan y se avisa.
    const { rows: [p] } = await pool.query(`SELECT title FROM gcc_world.projects WHERE id = $1`, [id]);
    const clean = newImages.filter((img: string) => img && img.trim());
    const uploaded: string[] = [];
    let fallo: string | null = null;
    for (const img of clean) {
      const d = decodificarDataUri(img);
      if (!d || !d.mime.startsWith('image/')) { uploaded.push(img); continue; } // ya era una URL
      try {
        const n = currentImages.length + uploaded.length + 1;
        const g = await guardar({
          datos: d.datos, mime: d.mime, base: `${p?.title || `Proyecto ${id}`} · foto ${String(n).padStart(2, '0')}`,
          modulo: 'proyecto_foto', referencia: id, ruta: ['Proyectos', `${id} · ${p?.title || ''}`.trim(), 'Fotos'],
        });
        uploaded.push(g.url);
      } catch (e: any) {
        fallo = e?.message || 'No se pudo guardar en Google Drive';
        break;
      }
    }
    const combined = [...currentImages, ...uploaded];

    await pool.query(
      `UPDATE gcc_world.projects SET images = $1, updated_at = NOW() WHERE id = $2`,
      [combined, id]
    );

    if (fallo) {
      return NextResponse.json({ error: `Se guardaron ${uploaded.length} de ${clean.length}: ${fallo}`, data: { images: combined, count: combined.length } }, { status: 502 });
    }
    return NextResponse.json({ data: { images: combined, count: combined.length, nombres: await nombresDe(combined) } });
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
    // Después de quitarla de la fila: si Drive fallara, la foto ya no se ve y solo queda
    // un archivo de más en Drive, nunca un hueco roto en la galería.
    await quitar(currentImages[index]).catch((e) => console.error('[images] papelera de Drive', e?.message));

    return NextResponse.json({ data: { images: updated, count: updated.length } });
  } catch (err: any) {
    console.error('Project images DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
