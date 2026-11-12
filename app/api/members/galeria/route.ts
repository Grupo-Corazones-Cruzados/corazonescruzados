import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { MIEMBROS_VISIBLES } from './sql';

export const dynamic = 'force-dynamic';

/**
 * LA GALERÍA DE MIEMBROS del formulario de postulación (Fernando, 2026-11-12): hasta 30 al azar, con
 * lo justo para presentarlos —nombre, foto, cargo, piso y paso—. Nada de correo ni teléfono: es una
 * ruta pública. La foto va por su propia ruta (las fotos se guardan como `data:` y pesarían en la lista).
 */
export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.name, p.name AS cargo, m.piso, m.paso,
              (COALESCE(u.avatar_url, m.photo_url) IS NOT NULL) AS con_foto
       ${MIEMBROS_VISIBLES}
       ORDER BY random()
       LIMIT 30`,
    );
    return NextResponse.json({
      data: rows.map((r: any) => ({
        id: r.id,
        nombre: r.name,
        cargo: r.cargo ?? null,
        piso: r.piso ?? null,
        paso: r.paso ?? null,
        foto: r.con_foto ? `/api/members/galeria/${r.id}/foto` : null,
      })),
    });
  } catch (err) {
    console.error('GET /api/members/galeria:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No se pudo cargar la galería', data: [] }, { status: 500 });
  }
}
