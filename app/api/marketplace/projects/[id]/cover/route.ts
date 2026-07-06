import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Portada (primera imagen) de un proyecto del marketplace. Endpoint ligero: la
 * lista NO envía imágenes (serían MB de base64 y dejaban la tabla vacía varios
 * segundos); cada tarjeta pide su portada aquí de forma perezosa. Lectura pública
 * solo para proyectos publicados; con sesión, cualquiera por id.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    const { rows: [row] } = await pool.query(
      `SELECT p.images[1] as cover, p.is_marketplace_published
       FROM gcc_world.projects p WHERE p.id = $1`,
      [id]
    );
    if (!row) return NextResponse.json({ cover: null }, { status: 404 });
    if (!user && !row.is_marketplace_published) return NextResponse.json({ cover: null }, { status: 404 });

    return NextResponse.json({ cover: row.cover || null });
  } catch {
    return NextResponse.json({ cover: null });
  }
}
