import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { MIEMBROS_VISIBLES } from '../../sql';

/** La foto de un miembro de la galería: la de su cuenta o la de su ficha (`data:` o un enlace). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new NextResponse(null, { status: 404 });
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(u.avatar_url, m.photo_url) AS foto ${MIEMBROS_VISIBLES} AND m.id = $1`,
      [id],
    );
    const foto: string | null = rows[0]?.foto ?? null;
    if (!foto) return new NextResponse(null, { status: 404 });
    const datos = /^data:([^;,]+);base64,([\s\S]*)$/.exec(foto);
    if (datos) {
      return new NextResponse(Buffer.from(datos[2], 'base64'), {
        headers: { 'Content-Type': datos[1], 'Cache-Control': 'public, max-age=3600' },
      });
    }
    if (/^https?:\/\//.test(foto) || foto.startsWith('/')) return NextResponse.redirect(new URL(foto, _req.url));
    return new NextResponse(null, { status: 404 });
  } catch (err) {
    console.error('GET /api/members/galeria/foto:', err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 500 });
  }
}
