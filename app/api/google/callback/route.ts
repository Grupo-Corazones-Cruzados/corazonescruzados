import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth/jwt';
import { guardarConexion, redirectUri, SCOPE_DRIVE } from '@/lib/integrations/google-oauth';

export const dynamic = 'force-dynamic';

const COOKIE_ESTADO = 'g_oauth_state';

const iguales = (a: string, b: string) => {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

/** GET — Google vuelve aquí con `code` y `state` (o con `error` si el usuario canceló). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const volver = (e: string) => {
    const res = NextResponse.redirect(new URL(`/dashboard/settings?tab=conexiones&google=${e}`, redirectUri(req.headers)));
    res.cookies.set(COOKIE_ESTADO, '', { path: '/api/google', maxAge: 0 });
    return res;
  };

  // El código se canjea PRIMERO que cualquier otra cosa que pueda caducar o fallar por
  // el navegador (lección del alta de WhatsApp): las comprobaciones de abajo son baratas.
  const error = url.searchParams.get('error');
  if (error) return volver(error === 'access_denied' ? 'cancelado' : 'error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const guardado = (await cookies()).get(COOKIE_ESTADO)?.value || '';
  const user = await getCurrentUser();
  if (!code || !guardado || !iguales(state, guardado)) return volver('estado_invalido');
  if (!user || state.split('.')[1] !== user.userId) return volver('estado_invalido');

  // Sin Drive no hay nada que hacer: el usuario pudo desmarcarlo en la pantalla de Google.
  const scopes = (url.searchParams.get('scope') || '').split(' ');
  if (!scopes.includes(SCOPE_DRIVE)) return volver('falta_drive');

  try {
    await guardarConexion(user.userId, code, redirectUri(req.headers));
    return volver('ok');
  } catch (e: any) {
    console.error('Google callback:', e?.message);
    return volver('error');
  }
}
