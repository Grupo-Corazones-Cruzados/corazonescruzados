import fs from 'node:fs';

/**
 * SUBIDA A YOUTUBE, por el protocolo reanudable: se abre una sesión y se manda por partes. Si una parte
 * falla, YouTube dice cuánto recibió y se sigue desde ahí. El archivo se lee del disco, no pasa a memoria.
 *
 * Las URL salen de variables solo para poder probar esto contra un servidor falso.
 */
const API = () => process.env['YOUTUBE_API_BASE'] || 'https://www.googleapis.com';
const TOKEN = () => process.env['GOOGLE_TOKEN_URL'] || 'https://oauth2.googleapis.com/token';
const PARTE = 16 * 1024 * 1024;
const REINTENTOS = 6;

export interface DatosVideo { titulo: string; descripcion: string; etiquetas: string[]; privacidad: 'private' | 'unlisted' | 'public'; programada: string | null }

/** Reconectar la cuenta es otra cosa que un fallo de red: hay que distinguirlo al mostrarlo. */
export class CuentaReconectar extends Error {}

export async function accesoDesdeRefresh(refresh: string): Promise<string> {
  const r = await fetch(TOKEN(), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
    body: new URLSearchParams({ client_id: process.env['GOOGLE_OAUTH_CLIENT_ID']!, client_secret: process.env['GOOGLE_OAUTH_CLIENT_SECRET']!, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.error === 'invalid_grant') throw new CuentaReconectar('Google retiró el acceso a este canal. Vuelve a conectarlo.');
  if (!r.ok || !j.access_token) throw new Error(j.error_description || `Google respondió ${r.status} al renovar el acceso.`);
  return j.access_token;
}

/** Los mensajes de Google traen la causa real: cuota, canal sin verificar, título inválido. */
async function motivo(r: Response): Promise<string> {
  const t = await r.text().catch(() => '');
  try {
    const j = JSON.parse(t);
    const razon = j.error?.errors?.[0]?.reason;
    if (razon === 'quotaExceeded' || razon === 'uploadLimitExceeded') return 'YouTube alcanzó su límite de subidas de hoy. Inténtalo mañana.';
    return j.error?.message || `YouTube respondió ${r.status}.`;
  } catch { return `YouTube respondió ${r.status}.`; }
}

function metadatos(d: DatosVideo) {
  return {
    snippet: { title: d.titulo, description: d.descripcion, tags: d.etiquetas, categoryId: '22' },
    status: {
      // Programar exige que el video esté privado hasta su hora: YouTube lo hace público entonces.
      privacyStatus: d.programada ? 'private' : d.privacidad,
      ...(d.programada ? { publishAt: new Date(d.programada).toISOString() } : {}),
      selfDeclaredMadeForKids: false,
    },
  };
}

export async function subirAYoutube(ruta: string, datos: DatosVideo, refresh: string, alAvanzar: (fraccion: number) => Promise<void> | void): Promise<{ id: string; url: string }> {
  const tamano = fs.statSync(ruta).size;
  let acceso = await accesoDesdeRefresh(refresh);
  const inicio = await fetch(`${API()}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
    method: 'POST', cache: 'no-store',
    headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'application/json', 'X-Upload-Content-Length': String(tamano), 'X-Upload-Content-Type': 'video/*' },
    body: JSON.stringify(metadatos(datos)),
  });
  if (!inicio.ok) throw new Error(await motivo(inicio));
  const sesion = inicio.headers.get('location');
  if (!sesion) throw new Error('YouTube no abrió la subida.');

  const fin = (json: any) => ({ id: String(json.id), url: `https://www.youtube.com/watch?v=${json.id}` });
  const leer = (desde: number, n: number) => {
    const buf = Buffer.allocUnsafe(n);
    const fd = fs.openSync(ruta, 'r');
    try { fs.readSync(fd, buf, 0, n, desde); } finally { fs.closeSync(fd); }
    return buf;
  };
  let desde = 0;
  let fallos = 0;
  while (desde < tamano) {
    const n = Math.min(PARTE, tamano - desde);
    let r: Response | null = null;
    try {
      r = await fetch(sesion, {
        method: 'PUT', cache: 'no-store',
        headers: { Authorization: `Bearer ${acceso}`, 'Content-Type': 'video/*', 'Content-Range': `bytes ${desde}-${desde + n - 1}/${tamano}` },
        body: new Uint8Array(leer(desde, n)),
      });
    } catch { /* red: se pregunta abajo cuánto recibió */ }
    if (r && (r.status === 200 || r.status === 201)) { await alAvanzar(1); return fin(await r.json()); }
    if (r?.status === 308) {
      const m = r.headers.get('range')?.match(/-(\d+)$/);
      desde = m ? Number(m[1]) + 1 : 0;
      fallos = 0;
      await alAvanzar(desde / tamano);
      continue;
    }
    if (r?.status === 401) { acceso = await accesoDesdeRefresh(refresh); continue; }
    if (r && r.status >= 400 && r.status < 500) throw new Error(await motivo(r));
    fallos += 1;
    if (fallos > REINTENTOS) throw new Error('Se perdió la conexión con YouTube. Vuelve a intentarlo.');
    await new Promise((ok) => setTimeout(ok, 1000 * 2 ** Math.min(fallos, 5)));
    // Tras un fallo no se sabe qué llegó: se le pregunta, con un PUT vacío, como pide el protocolo.
    const q = await fetch(sesion, { method: 'PUT', cache: 'no-store', headers: { Authorization: `Bearer ${acceso}`, 'Content-Range': `bytes */${tamano}` } }).catch(() => null);
    if (q && (q.status === 200 || q.status === 201)) { await alAvanzar(1); return fin(await q.json()); }
    if (q?.status === 308) { const m = q.headers.get('range')?.match(/-(\d+)$/); desde = m ? Number(m[1]) + 1 : 0; }
  }
  throw new Error('La subida terminó sin respuesta de YouTube.');
}
