import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { COOKIE, enVentana, entregaPorToken } from '@/lib/entregas';
import { descargaDeDrive } from '@/lib/media/descarga-privada';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/entrega-publica/<token>/archivos/<fileId> — descarga, solo desde el navegador que la
 * abrió y dentro de su ventana. Cada descarga queda anotada para quien la envió.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const e = await entregaPorToken(token);
  const user = await getCurrentUser();
  if (!e || !enVentana(e, req.cookies.get(COOKIE(e.id))?.value, user ? { userId: String(user.userId) } : null)) {
    return new NextResponse('Esta entrega ya no está disponible', { status: 410 });
  }
  const res = await descargaDeDrive(e.archivos, fileId);
  if (res.ok) {
    pool.query(
      `UPDATE gcc_world.entregas_unicas SET descargas = descargas || $2::jsonb WHERE id = $1`,
      [e.id, JSON.stringify([{ id: fileId, en: new Date().toISOString() }])],
    ).catch((err: any) => console.error('[entregas] anotar descarga', err?.message));
  }
  return res;
}
