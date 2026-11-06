import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { rechazo, usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { origenPublico } from '@/lib/integrations/google-oauth';
import { guardarCuenta } from '@/lib/centralized/publicar';

export const dynamic = 'force-dynamic';

const pagina = (mensaje: string) => new Response(
  `<!doctype html><meta charset="utf-8"><title>YouTube</title><body style="font-family:system-ui;padding:40px;text-align:center"><p>${mensaje}</p><script>try{window.opener&&window.opener.postMessage('red-conectada','*')}catch(e){}</script></body>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

export async function GET(req: Request) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const url = new URL(req.url);
  if (url.searchParams.get('error')) return pagina('No se conectó el canal. Puedes cerrar esta ventana.');
  const guardado = (await cookies()).get('yt_oauth_estado')?.value || '';
  const estado = url.searchParams.get('state') || '';
  const a = Buffer.from(estado); const b = Buffer.from(guardado);
  if (!guardado || a.length !== b.length || !timingSafeEqual(a, b)) return pagina('La conexión caducó. Vuelve a intentarlo.');
  if ((await usuarioLocal())?.role !== 'admin') return pagina('No autorizado.');
  try {
    const t = await fetch(process.env['GOOGLE_TOKEN_URL'] || 'https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
      body: new URLSearchParams({
        code: url.searchParams.get('code') || '', client_id: process.env['GOOGLE_OAUTH_CLIENT_ID']!, client_secret: process.env['GOOGLE_OAUTH_CLIENT_SECRET']!,
        grant_type: 'authorization_code', redirect_uri: `${origenPublico(req.headers)}/api/centralized/generacion-contenido/redes/youtube/callback`,
      }),
    }).then((r) => r.json());
    if (!t.refresh_token) throw new Error(t.error_description || 'Google no entregó un permiso permanente.');
    const c = await fetch(`${process.env['YOUTUBE_API_BASE'] || 'https://www.googleapis.com'}/youtube/v3/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${t.access_token}` }, cache: 'no-store' }).then((r) => r.json());
    const canal = c.items?.[0];
    if (!canal) throw new Error(c.error?.message || 'Esa cuenta no tiene un canal de YouTube.');
    await guardarCuenta('youtube', canal.id, canal.snippet.title, t.refresh_token);
    return pagina(`Canal «${String(canal.snippet.title).replace(/[<>&]/g, '')}» conectado. Puedes cerrar esta ventana.`);
  } catch (e: any) {
    console.error('Conectar YouTube:', e?.message);
    return pagina(`No se pudo conectar: ${String(e?.message || '').replace(/[<>&]/g, '')}`);
  }
}
