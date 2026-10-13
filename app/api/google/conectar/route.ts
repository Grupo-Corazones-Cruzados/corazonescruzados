import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { googleOAuthConfigurado, redirectUri, urlAutorizacion, leerConexion } from '@/lib/integrations/google-oauth';

export const dynamic = 'force-dynamic';

const COOKIE_ESTADO = 'g_oauth_state';

/**
 * GET — empieza la conexión con Google: redirige a la pantalla de permisos.
 *
 * El `state` es un valor al azar que también se guarda en una cookie de este navegador.
 * El callback exige que coincidan Y que la sesión siga siendo la misma: así nadie puede
 * mandarle a otro un enlace que acabe conectando el Drive de la víctima a la cuenta del
 * atacante (CSRF de enlace de cuentas).
 */
export async function GET(req: Request) {
  const base = new URL(req.url);
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', base));
  const volver = (e: string) => NextResponse.redirect(new URL(`/dashboard/settings?tab=conexiones&google=${e}`, redirectUri(req.headers)));
  if (!(await resolveSubject(user))) return volver('sin_acceso');
  if (!googleOAuthConfigurado()) return volver('no_configurado');

  const nonce = randomBytes(24).toString('base64url');
  const state = `${nonce}.${user.userId}`;
  const actual = await leerConexion(user.userId);
  const res = NextResponse.redirect(urlAutorizacion({ redirectUri: redirectUri(req.headers), state, loginHint: actual?.email }));
  res.cookies.set(COOKIE_ESTADO, state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/api/google', maxAge: 600,
  });
  return res;
}
