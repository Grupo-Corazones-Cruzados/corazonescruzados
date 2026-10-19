import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { abrirSubida, acceso, MAX_BYTES, MAX_SUBIDAS, porToken, rutaDe } from '@/lib/enlaces';

export const runtime = 'nodejs';

/**
 * POST /api/enlace-publico/<token>/subida { nombre, tipo, tamano } — abre la subida de UN
 * archivo directo al Drive de la empresa y devuelve la URL a la que el navegador manda los
 * bytes. El servidor nunca los recibe (ver `lib/enlaces`).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await porToken(token);
  const user = await getCurrentUser();
  const a = acceso(e, user ? { userId: String(user.userId) } : null);
  if (!a.ok) return NextResponse.json({ error: 'Este enlace ya no admite respuestas', motivo: a.motivo }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const nombre = String(b.nombre || '').trim() || 'archivo';
  const mime = String(b.tipo || '').trim() || 'application/octet-stream';
  const tamano = Math.floor(Number(b.tamano));
  if (!(tamano > 0)) return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
  if (tamano > MAX_BYTES) return NextResponse.json({ error: `«${nombre}» pasa de 100 MB` }, { status: 400 });

  // Tope de subidas por enlace: quien tenga el enlace no puede llenar el Drive.
  const r = await pool.query(
    `UPDATE gcc_world.enlaces_unicos SET subidas = subidas + 1 WHERE id = $1 AND subidas < $2`,
    [e.id, MAX_SUBIDAS],
  );
  if (!r.rowCount) return NextResponse.json({ error: 'Se alcanzó el máximo de subidas de este enlace' }, { status: 429 });

  const origin = req.headers.get('origin') || req.nextUrl.origin;
  try {
    const url = await abrirSubida({ ruta: rutaDe(e), nombre, mime, tamano, origin });
    return NextResponse.json({ data: { url } });
  } catch (err: any) {
    console.error('[enlaces] subida', err?.message);
    return NextResponse.json({ error: 'No se pudo preparar la subida. Inténtalo de nuevo.' }, { status: 502 });
  }
}
