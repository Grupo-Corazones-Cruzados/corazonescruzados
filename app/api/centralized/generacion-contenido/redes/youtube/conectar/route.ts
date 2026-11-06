import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { rechazo, usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { origenPublico } from '@/lib/integrations/google-oauth';

export const dynamic = 'force-dynamic';
const COOKIE = 'yt_oauth_estado';
/** Solo subir y saber qué canal se eligió. Va aparte de la conexión de Drive y Gmail, una vez por canal. */
const PERMISOS = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

export async function GET(req: Request) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const u = await usuarioLocal();
  if (u?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const estado = crypto.randomBytes(24).toString('hex');
  const origen = origenPublico(req.headers);
  const p = new URLSearchParams({
    client_id: process.env['GOOGLE_OAUTH_CLIENT_ID']!, redirect_uri: `${origen}/api/centralized/generacion-contenido/redes/youtube/callback`,
    response_type: 'code', scope: PERMISOS, access_type: 'offline', prompt: 'select_account consent', state: estado,
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${p}`);
  res.cookies.set(COOKIE, estado, { httpOnly: true, sameSite: 'lax', path: '/api/centralized/generacion-contenido/redes/youtube', maxAge: 600 });
  return res;
}
