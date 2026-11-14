import http2 from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';
import { pool } from '@/lib/db';

/**
 * PUSH A IPHONE por Apple Push Notification service (Fernando, 2026-10-07).
 *
 * Hoy solo se usa para la Actividad en Vivo del reloj del ticket (arrancarla y terminarla con
 * la app cerrada). La clave es la del equipo de Apple con que se firma la app — de momento el
 * del cliente, de forma provisional —, así que TODO sale de variables, nada escrito aquí:
 *   APNS_KEY (contenido del .p8) · APNS_KEY_ID · APNS_TEAM_ID · APNS_BUNDLE_ID
 * Mudar la app a la cuenta propia = cambiar esas cuatro variables y recompilar.
 *
 * ⇒ DOS APPS (2026-11-14): GCC World y GCC Miembros son de la cuenta de Fernando (K7PVYYMP32) y cada una
 * tiene su identificador. `APNS_BUNDLE_ID` lleva los dos separados por coma; como el token no dice de qué
 * app es, se prueban en orden (Apple responde `DeviceTokenNotForTopic` al equivocado) y el que acierta
 * queda en `push_devices.apns_bundle` (migración 092).
 *
 * APNs exige HTTP/2 (por eso `node:http2` y no `fetch`) y un JWT ES256 que se puede reutilizar
 * hasta una hora; se renueva a los 50 minutos.
 *
 * Nunca lanza: una push que no sale no puede tumbar la acción que la provocó.
 */

const HOST = { sandbox: 'https://api.sandbox.push.apple.com', production: 'https://api.push.apple.com' } as const;
export type EntornoApns = keyof typeof HOST;

let jwt: { valor: string; hecho: number } | null = null;

function configurado() {
  const { APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID } = process.env;
  return APNS_KEY && APNS_KEY_ID && APNS_TEAM_ID && APNS_BUNDLE_ID
    ? { clave: APNS_KEY.replace(/\\n/g, '\n'), keyId: APNS_KEY_ID, teamId: APNS_TEAM_ID,
        bundles: APNS_BUNDLE_ID.split(',').map((b) => b.trim()).filter(Boolean) }
    : null;
}

async function token(c: NonNullable<ReturnType<typeof configurado>>): Promise<string> {
  if (jwt && Date.now() - jwt.hecho < 50 * 60_000) return jwt.valor;
  const clave = await importPKCS8(c.clave, 'ES256');
  const valor = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: c.keyId })
    .setIssuer(c.teamId)
    .setIssuedAt()
    .sign(clave);
  jwt = { valor, hecho: Date.now() };
  return valor;
}

function enviarUno(entorno: EntornoApns, ruta: string, cabeceras: Record<string, string>, cuerpo: string):
  Promise<{ estado: number; motivo?: string }> {
  return new Promise((resolve) => {
    const cliente = http2.connect(HOST[entorno]);
    cliente.on('error', (e) => resolve({ estado: 0, motivo: e.message }));
    const req = cliente.request({ ':method': 'POST', ':path': ruta, ...cabeceras });
    let estado = 0; let datos = '';
    req.on('response', (h) => { estado = Number(h[':status']) || 0; });
    req.on('data', (d) => { datos += d; });
    req.on('end', () => {
      cliente.close();
      let motivo: string | undefined;
      try { motivo = JSON.parse(datos).reason; } catch { /* cuerpo vacío en 200 */ }
      resolve({ estado, motivo });
    });
    req.on('error', (e) => { cliente.close(); resolve({ estado: 0, motivo: e.message }); });
    req.setTimeout(15_000, () => { req.close(); cliente.close(); resolve({ estado: 0, motivo: 'timeout' }); });
    req.end(cuerpo);
  });
}

/** El identificador de app que Apple ya aceptó para cada token (los demás, sin saber todavía). */
async function bundlesConocidos(tokens: string[]): Promise<Map<string, string>> {
  try {
    const { rows } = await pool.query(
      `SELECT token, apns_bundle FROM gcc_world.push_devices WHERE token = ANY($1) AND apns_bundle IS NOT NULL`, [tokens]);
    return new Map(rows.map((r: any) => [r.token, r.apns_bundle]));
  } catch { return new Map(); } // sin la migración 092: se prueban todos
}

/**
 * Un envío a un token probando los identificadores de app en orden (el conocido primero). Al acertar uno
 * distinto del guardado, lo guarda.
 */
async function enviarConTema(
  bundles: string[], conocido: string | undefined, sufijo: string,
  entorno: EntornoApns, t: string, cabeceras: Record<string, string>, cuerpo: string,
): Promise<{ estado: number; motivo?: string }> {
  const orden = conocido ? [conocido, ...bundles.filter((b) => b !== conocido)] : bundles;
  let r: { estado: number; motivo?: string } = { estado: 0, motivo: 'sin identificador de app' };
  for (const b of orden) {
    r = await enviarUno(entorno, `/3/device/${t}`, { ...cabeceras, 'apns-topic': b + sufijo }, cuerpo);
    if (r.motivo === 'DeviceTokenNotForTopic' || r.motivo === 'TopicDisallowed') continue;
    if (r.estado === 200 && b !== conocido) {
      await pool.query(`UPDATE gcc_world.push_devices SET apns_bundle = $1 WHERE token = $2`, [b, t]).catch(() => {});
    }
    return r;
  }
  return r;
}

/**
 * Envía un evento a Actividades en Vivo (`start` a un token de arranque, `end`/`update` al
 * token de una actividad). Borra los tokens que Apple da por muertos.
 */
export async function enviarActividadEnVivo(
  destinos: { token: string; entorno: EntornoApns }[],
  aps: Record<string, unknown>,
): Promise<void> {
  if (!destinos.length) return;
  const c = configurado();
  if (!c) { console.error('APNs: faltan APNS_KEY / APNS_KEY_ID / APNS_TEAM_ID / APNS_BUNDLE_ID'); return; }
  try {
    const bearer = await token(c);
    const cuerpo = JSON.stringify({ aps: { timestamp: Math.floor(Date.now() / 1000), ...aps } });
    const muertos: string[] = [];
    const conocidos = await bundlesConocidos(destinos.map((d) => d.token));
    await Promise.all(destinos.map(async ({ token: t, entorno }) => {
      const r = await enviarConTema(c.bundles, conocidos.get(t), '.push-type.liveactivity', entorno, t, {
        authorization: `bearer ${bearer}`,
        'apns-push-type': 'liveactivity',
        'apns-priority': '10',
        'content-type': 'application/json',
      }, cuerpo);
      if (r.estado === 200) return;
      if (r.estado === 410 || r.motivo === 'BadDeviceToken' || r.motivo === 'Unregistered') muertos.push(t);
      else console.error('APNs envío', r.estado, r.motivo);
    }));
    if (muertos.length) {
      await pool.query(`DELETE FROM gcc_world.push_devices WHERE kind LIKE 'apns%' AND token = ANY($1)`, [muertos]);
    }
  } catch (e: any) {
    console.error('APNs error:', e?.message);
  }
}

/**
 * Aviso normal (banner) al iPhone: título, texto y la ruta de la plataforma que abre al
 * tocarlo (`ruta`, la lee `AppDelegate`). Va al token `apns` del teléfono.
 */
export async function enviarAvisoApns(
  destinos: { token: string; entorno: EntornoApns }[],
  aviso: { titulo: string; cuerpo: string; ruta?: string; categoria?: string; hilo?: string; datos?: Record<string, string>; urgente?: boolean },
): Promise<void> {
  if (!destinos.length) return;
  const c = configurado();
  if (!c) { console.error('APNs: faltan APNS_KEY / APNS_KEY_ID / APNS_TEAM_ID / APNS_BUNDLE_ID'); return; }
  try {
    const bearer = await token(c);
    // `category` decide los botones (CHAT = «Responder» con texto); `thread-id` agrupa los
    // avisos de una misma conversación, como WhatsApp.
    const cuerpo = JSON.stringify({
      aps: {
        // El tono de GCC va dentro de la app (`App/gcc_aviso.caf`, 2026-10-29); una app instalada
        // antes de llevarlo suena con el de siempre: iOS cae al sonido por defecto si no lo encuentra.
        alert: { title: aviso.titulo, body: aviso.cuerpo }, sound: aviso.urgente ? 'default' : 'gcc_aviso.caf',
        // Un auxilio traspasa los modos de concentración (permiso `time-sensitive`).
        ...(aviso.urgente ? { 'interruption-level': 'time-sensitive', 'relevance-score': 1 } : {}),
        ...(aviso.categoria ? { category: aviso.categoria } : {}),
        ...(aviso.hilo ? { 'thread-id': aviso.hilo } : {}),
      },
      ruta: aviso.ruta || null,
      ...(aviso.datos || {}),
    });
    const muertos: string[] = [];
    const conocidos = await bundlesConocidos(destinos.map((d) => d.token));
    await Promise.all(destinos.map(async ({ token: t, entorno }) => {
      const r = await enviarConTema(c.bundles, conocidos.get(t), '', entorno, t, {
        authorization: `bearer ${bearer}`,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      }, cuerpo);
      if (r.estado === 200) return;
      if (r.estado === 410 || r.motivo === 'BadDeviceToken' || r.motivo === 'Unregistered') muertos.push(t);
      else console.error('APNs aviso', r.estado, r.motivo);
    }));
    if (muertos.length) {
      await pool.query(`DELETE FROM gcc_world.push_devices WHERE kind = 'apns' AND token = ANY($1)`, [muertos]);
    }
  } catch (e: any) {
    console.error('APNs aviso error:', e?.message);
  }
}

/** Las fechas de ActivityKit viajan como segundos desde el 1-ene-2001 (`Date` de Swift). */
export function fechaSwift(iso: string): number {
  return new Date(iso).getTime() / 1000 - 978_307_200;
}
