import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { contenido, COOKIE, entregaPorToken, hashSesion, puedeAbrir, VENTANA_MIN } from '@/lib/entregas';

export const runtime = 'nodejs';

/**
 * POST /api/entrega-publica/<token>/abrir — «Ver y descargar»: GASTA la entrega y le da a ESTE
 * navegador `VENTANA_MIN` para bajar los archivos (cookie con un secreto; en la fila, su hash).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await entregaPorToken(token);
  const user = await getCurrentUser();
  const a = puedeAbrir(e, user ? { userId: String(user.userId) } : null);
  if (!a.ok) return NextResponse.json({ error: 'Esta entrega ya no está disponible', motivo: a.motivo }, { status: 409 });

  const secreto = crypto.randomBytes(32).toString('base64url');
  // `AND estado = 'vigente' AND vence_en > NOW()`: dos navegadores a la vez, solo uno entra.
  const { rows: [f] } = await pool.query(
    `UPDATE gcc_world.entregas_unicas
        SET estado = 'usado', abierto_en = NOW(), abierto_por = $2, sesion_hash = $3
      WHERE id = $1 AND estado = 'vigente' AND vence_en > NOW()
      RETURNING abierto_en`,
    [e.id, user ? String(user.userId) : null, hashSesion(secreto)],
  );
  if (!f) return NextResponse.json({ error: 'Esta entrega ya se usó', motivo: 'usado' }, { status: 409 });

  const res = NextResponse.json({ data: { motivo: null, abierta: true, ...contenido({ ...e, abierto_en: f.abierto_en }) } });
  res.cookies.set(COOKIE(e.id), secreto, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax',
    path: `/api/entrega-publica/${token}`, maxAge: VENTANA_MIN * 60,
  });
  return res;
}
