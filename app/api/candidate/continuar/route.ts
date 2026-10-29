import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { pool } from '@/lib/db';
import { CLIENT_COOKIE } from '@/lib/world/session';

/**
 * EL ENLACE DEL CORREO DE APROBACIÓN (Fernando, 2026-10-29).
 *
 * `?t=` es el `client_token` que la aprobación le dio a la fila del candidato. Si corresponde a un
 * candidato APROBADO que aún NO completó su cuenta, se deja ese token en su navegador (como hacía
 * la portada cuando reconocía su equipo) y se le manda a la portada con `?acceso=candidato-aprobado`
 * y su correo, que abre la creación de la cuenta. Una vez completada, el enlace ya no sirve: lleva
 * a la portada sin más. Así se completa el alta desde cualquier dispositivo.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin;
  const destino = new URL('/', base);
  const token = url.searchParams.get('t') || '';
  if (!/^[a-f0-9]{32,128}$/i.test(token)) return NextResponse.redirect(destino);
  try {
    const { rows: [fila] } = await pool.query(
      `SELECT email FROM gcc_world.clients
        WHERE client_token = $1 AND account_type = 'candidate' AND approved = true
          AND COALESCE(profile_completed, false) = false
        LIMIT 1`,
      [token],
    );
    if (!fila) return NextResponse.redirect(destino);
    const almacen = await cookies();
    almacen.set(CLIENT_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    destino.searchParams.set('acceso', 'candidato-aprobado');
    if (fila.email) destino.searchParams.set('correo', String(fila.email));
    return NextResponse.redirect(destino);
  } catch (e) {
    console.error('[candidate/continuar]', (e as Error).message);
    return NextResponse.redirect(destino);
  }
}
