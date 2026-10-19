import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { abrirSubida, MAX_BYTES, MAX_SUBIDAS } from '@/lib/enlaces';
import { asegurarTablaEntregas, rutaEntrega } from '@/lib/entregas';

export const runtime = 'nodejs';

/**
 * POST /api/entregas/<id>/subida { nombre, tipo, tamano } — abre la subida de UN archivo del
 * borrador directo al Drive de la empresa (el servidor no ve los bytes). Solo su creador y solo
 * mientras está `preparando`: publicada, la lista de archivos ya no cambia.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  const { id } = await params;
  await asegurarTablaEntregas();

  const b = await req.json().catch(() => ({}));
  const nombre = String(b.nombre || '').trim() || 'archivo';
  const mime = String(b.tipo || '').trim() || 'application/octet-stream';
  const tamano = Math.floor(Number(b.tamano));
  if (!(tamano > 0)) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
  if (tamano > MAX_BYTES) return NextResponse.json({ error: `«${nombre}» pasa de 100 MB` }, { status: 400 });

  const r = await pool.query(
    `UPDATE gcc_world.entregas_unicas SET subidas = subidas + 1
      WHERE id = $1 AND creado_por = $2::uuid AND estado = 'preparando' AND subidas < $3 RETURNING id`,
    [Number(id), String(user.userId), MAX_SUBIDAS],
  );
  if (!r.rowCount) return NextResponse.json({ error: 'No se pueden añadir más archivos a esta entrega' }, { status: 409 });

  try {
    const url = await abrirSubida({ ruta: rutaEntrega({ id: Number(id) }), nombre, mime, tamano, origin: req.headers.get('origin') || req.nextUrl.origin });
    return NextResponse.json({ data: { url } });
  } catch (err: any) {
    console.error('[entregas] subida', err?.message);
    return NextResponse.json({ error: 'No se pudo preparar la subida. Inténtalo de nuevo.' }, { status: 502 });
  }
}
