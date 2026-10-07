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
    ? { clave: APNS_KEY.replace(/\\n/g, '\n'), keyId: APNS_KEY_ID, teamId: APNS_TEAM_ID, bundle: APNS_BUNDLE_ID }
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
    await Promise.all(destinos.map(async ({ token: t, entorno }) => {
      const r = await enviarUno(entorno, `/3/device/${t}`, {
        authorization: `bearer ${bearer}`,
        'apns-push-type': 'liveactivity',
        'apns-topic': `${c.bundle}.push-type.liveactivity`,
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

/** Las fechas de ActivityKit viajan como segundos desde el 1-ene-2001 (`Date` de Swift). */
export function fechaSwift(iso: string): number {
  return new Date(iso).getTime() / 1000 - 978_307_200;
}
