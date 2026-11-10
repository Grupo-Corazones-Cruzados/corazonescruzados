import { NextResponse } from 'next/server';
import { origenPublico } from '@/lib/integrations/google-oauth';

const limpio = (t: string) => t.replace(/[<>&"]/g, '');

/**
 * Cómo termina una conexión. En la web vuelve a Configuración con el resultado; desde la app, que la abrió en
 * el navegador del sistema, se queda en una página que dice qué pasó: la app se actualiza al volver a ella.
 */
export function paginaResultado(req: Request, origen: 'web' | 'app' | null, mensaje: string, ok = false) {
  if (origen === 'web') {
    const p = new URLSearchParams({ tab: 'conexiones', redes: ok ? 'ok' : 'error', msg: mensaje });
    return NextResponse.redirect(new URL(`/dashboard/settings?${p}`, origenPublico(req.headers)));
  }
  return new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GCC World</title>`
    + `<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#111b21;color:#e9edef;font-family:system-ui;padding:24px;text-align:center">`
    + `<div><p style="font-size:17px;margin:0 0 8px">${limpio(mensaje)}</p><p style="font-size:14px;color:#8696a0;margin:0">Ya puedes volver a la app.</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
