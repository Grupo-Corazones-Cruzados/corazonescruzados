import webpush from 'web-push';
import { pool } from '@/lib/db';

/**
 * ⇒ NOTIFICACIONES PUSH (Fernando, 2026-10-19). Llegan al teléfono o al ordenador aunque el
 * panel esté cerrado: las entrega el servicio push del navegador (Google, Apple, Mozilla) al
 * service worker (`public/sw.js`), que las muestra.
 *
 * - Claves VAPID en `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (en `.env.local` y
 *   en Railway). La pública viaja al navegador por `/api/push/clave`, no en el build.
 * - Una suscripción por navegador/dispositivo (`endpoint` único); una persona puede tener varias.
 * - En iPhone solo funcionan con la app INSTALADA en la pantalla de inicio (iOS 16.4+).
 * - Si el servicio responde 404/410 la suscripción murió (permiso retirado, app desinstalada) y
 *   se borra.
 */

export type Suscripcion = { endpoint: string; keys: { p256dh: string; auth: string } };
export type CargaPush = { titulo: string; cuerpo: string; url: string; etiqueta?: string; insistir?: boolean };

export const clavePublica = () => process.env.VAPID_PUBLIC_KEY || '';
const configurado = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let listo = false;
function preparar() {
  if (listo) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:lfgonzalezm0@grupocc.org',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  listo = true;
}

let asegurando: Promise<void> | null = null;
export function asegurarTablaPush(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.push_suscripciones (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        agente TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        usado_en TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS push_suscripciones_user_idx ON gcc_world.push_suscripciones(user_id);
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

/** Guarda (o pasa a esta persona) la suscripción de un navegador. */
export async function guardarSuscripcion(userId: string, s: Suscripcion, agente: string | null) {
  await asegurarTablaPush();
  await pool.query(
    `INSERT INTO gcc_world.push_suscripciones (user_id, endpoint, p256dh, auth, agente)
     VALUES ($1::uuid, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth, agente = EXCLUDED.agente`,
    [userId, s.endpoint, s.keys.p256dh, s.keys.auth, agente],
  );
}

export async function borrarSuscripcion(userId: string, endpoint: string) {
  await asegurarTablaPush();
  await pool.query(`DELETE FROM gcc_world.push_suscripciones WHERE endpoint = $1 AND user_id = $2::uuid`, [endpoint, userId]);
}

/** Manda la notificación a todos los dispositivos de la persona. Devuelve cuántos la aceptaron. */
export async function enviarPush(userId: string, carga: CargaPush): Promise<number> {
  if (!configurado()) return 0;
  preparar();
  await asegurarTablaPush();
  const { rows } = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM gcc_world.push_suscripciones WHERE user_id = $1::uuid`, [userId]);
  let ok = 0;
  await Promise.all(rows.map(async (r: any) => {
    try {
      // TTL corto: un aviso de «faltan 5 min» que llega media hora tarde estorba.
      await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        JSON.stringify(carga),
        { TTL: 15 * 60, urgency: 'high' },
      );
      ok++;
      await pool.query(`UPDATE gcc_world.push_suscripciones SET usado_en = NOW() WHERE id = $1`, [r.id]);
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await pool.query(`DELETE FROM gcc_world.push_suscripciones WHERE id = $1`, [r.id]);
      } else {
        console.error('[push] no salió', e?.statusCode, e?.body || e?.message);
      }
    }
  }));
  return ok;
}
