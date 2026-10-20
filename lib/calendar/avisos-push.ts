import { pool } from '@/lib/db';
import type { CalendarEvent } from '@/lib/calendar/recurrence';
import { avisosPendientes, claveAviso, textoAviso, UMBRALES } from '@/lib/calendar/avisos';
import { asegurarTablaPush, enviarPush } from '@/lib/push';
import { avisarUsuarios } from '@/lib/push/avisos';
import { reunionesGoogleProximas } from '@/lib/calendar/google';

/**
 * ⇒ PUSH DE LAS REUNIONES DE MI DÍA (Fernando, 2026-10-19): 1 h, 30, 15 y 5 min antes, al
 * teléfono aunque el panel esté cerrado. Reglas en `lib/calendar/avisos.ts`.
 *
 * Lo corre el propio servidor web cada minuto (`instrumentation.ts`) y, de respaldo, el cron
 * frecuente cada 10 min (`/api/calendar/cron/avisos`). Es IDEMPOTENTE: cada aviso se «reclama»
 * con un INSERT de su clave en `avisos_reunion`, así que dos réplicas, un despliegue a medias o
 * el cron a la vez nunca mandan el mismo aviso dos veces. Si se pierde un minuto (despliegue),
 * sale en el siguiente; pasado el umbral siguiente, sale ese y no el viejo.
 *
 * Va a los dos canales: push web (navegador / PWA, `push_suscripciones`) y la app nativa
 * (`push_devices`, por `avisarUsuarios`). Solo mira a quien tiene alguno: si no, no hay a quién mandar.
 */

let asegurando: Promise<void> | null = null;
function asegurarTablaAvisos(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.avisos_reunion (
        clave TEXT NOT NULL,
        user_id UUID NOT NULL,
        enviado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (clave, user_id)
      );
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

let corriendo = false;

export async function revisarAvisosPush(ahora = Date.now()): Promise<{ enviados: number; dispositivos: number }> {
  if (corriendo) return { enviados: 0, dispositivos: 0 };
  corriendo = true;
  try {
    await Promise.all([asegurarTablaPush(), asegurarTablaAvisos()]);
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.description, e.event_type, e.client_id, c.name AS client_name,
              e.start_at, e.end_at, e.all_day, e.timezone, e.recurrence_type, e.recurrence_days,
              e.recurrence_interval, to_char(e.recurrence_until, 'YYYY-MM-DD') AS recurrence_until,
              e.color, e.status, e.availability_status, e.meeting_url, u.id AS user_id
         FROM gcc_world.member_calendar_events e
         JOIN gcc_world.users u ON u.member_id = e.member_id
         LEFT JOIN gcc_world.clients c ON c.id = e.client_id
        WHERE e.status = 'confirmed' AND NOT e.all_day AND e.availability_status IS NULL
          AND (EXISTS (SELECT 1 FROM gcc_world.push_suscripciones s WHERE s.user_id = u.id)
               OR EXISTS (SELECT 1 FROM gcc_world.push_devices d WHERE d.user_id = u.id AND d.kind IN ('fcm', 'apns')))
          AND (
            (e.recurrence_type = 'none' AND e.start_at BETWEEN $1::timestamptz - INTERVAL '6 minutes'
                                                          AND $1::timestamptz + INTERVAL '61 minutes')
            OR (e.recurrence_type <> 'none' AND e.start_at <= $1::timestamptz + INTERVAL '61 minutes'
                AND (e.recurrence_until IS NULL OR e.recurrence_until >= ($1::timestamptz - INTERVAL '2 days')::date))
          )`,
      [new Date(ahora).toISOString()],
    );

    const porPersona = new Map<string, CalendarEvent[]>();
    for (const r of rows) porPersona.set(r.user_id, [...(porPersona.get(r.user_id) || []), r]);

    // Más las reuniones de su cuenta de Google (Mi día las muestra; `lib/calendar/google.ts`).
    const { rows: conGoogle } = await pool.query(
      `SELECT g.user_id FROM gcc_world.google_conexiones g
        WHERE g.estado = 'activa' AND 'https://www.googleapis.com/auth/calendar' = ANY(g.scopes)
          AND (EXISTS (SELECT 1 FROM gcc_world.push_suscripciones s WHERE s.user_id = g.user_id)
               OR EXISTS (SELECT 1 FROM gcc_world.push_devices d WHERE d.user_id = g.user_id AND d.kind IN ('fcm', 'apns')))`,
    ).catch(() => ({ rows: [] as any[] }));
    for (const { user_id } of conGoogle) {
      const g = await reunionesGoogleProximas(String(user_id), ahora);
      if (g.length) porPersona.set(String(user_id), [...(porPersona.get(String(user_id)) || []), ...g]);
    }

    let enviados = 0, dispositivos = 0;
    for (const [userId, eventos] of porPersona) {
      for (const a of avisosPendientes(eventos, ahora)) {
        const clave = claveAviso(a.ev, a.inicio, a.umbral);
        const { rowCount } = await pool.query(
          `INSERT INTO gcc_world.avisos_reunion (clave, user_id) VALUES ($1, $2::uuid) ON CONFLICT DO NOTHING`,
          [clave, userId],
        );
        if (!rowCount) continue;
        // Los umbrales mayores quedan dados: no se avisan después de uno más cercano.
        for (const u of UMBRALES) if (u > a.umbral) {
          await pool.query(
            `INSERT INTO gcc_world.avisos_reunion (clave, user_id) VALUES ($1, $2::uuid) ON CONFLICT DO NOTHING`,
            [claveAviso(a.ev, a.inicio, u), userId],
          );
        }
        const { titulo, detalle } = textoAviso(a.ev, a.faltan, a.ev.timezone || 'America/Guayaquil');
        dispositivos += await enviarPush(userId, {
          titulo,
          cuerpo: detalle,
          url: a.ev.meeting_url || '/dashboard/mi-dia',
          // Misma etiqueta para la misma reunión: el aviso nuevo reemplaza al anterior.
          etiqueta: `reunion-${a.ev.id}-${a.inicio}`,
          insistir: a.umbral <= 5,
        });
        // La app nativa (Android/iPhone) no tiene push web: va por su canal de siempre, el de los
        // recordatorios. Abre Mi día: el aviso nativo solo sabe abrir rutas de la plataforma.
        await avisarUsuarios([userId], { titulo, cuerpo: detalle, ruta: '/dashboard/mi-dia', hilo: 'reuniones' });
        enviados++;
      }
    }
    // Lo de hace más de 2 días ya no puede repetirse.
    await pool.query(`DELETE FROM gcc_world.avisos_reunion WHERE enviado_en < NOW() - INTERVAL '2 days'`);
    return { enviados, dispositivos };
  } finally {
    corriendo = false;
  }
}

/**
 * ⇒ PROPUESTA NUEVA EN MI DÍA (Fernando, 2026-10-19): alguien reservó un horario desde el
 * calendario público. Llega a los tres sitios a la vez: la campana del panel (`notifications`),
 * el push web y la app nativa; el correo de siempre lo manda la ruta. Va a todas las cuentas
 * enlazadas al miembro. Nunca lanza: la propuesta ya quedó guardada.
 */
export async function avisarPropuesta(
  memberId: string,
  p: { id: string | number; titulo: string; quien: string; inicio: string | Date; zona: string },
): Promise<void> {
  try {
    const { rows } = await pool.query(`SELECT id FROM gcc_world.users WHERE member_id = $1`, [memberId]);
    if (!rows.length) return;
    let zona = p.zona;
    try { new Intl.DateTimeFormat('es-ES', { timeZone: zona }); } catch { zona = 'America/Guayaquil'; }
    const cuando = new Intl.DateTimeFormat('es-ES', {
      timeZone: zona, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(p.inicio));
    const titulo = 'Nueva propuesta de reunión';
    const cuerpo = `${p.quien} propone «${p.titulo}» · ${cuando}`;
    const { createNotification } = await import('@/lib/notifications');
    for (const u of rows) {
      const userId = String(u.id);
      await createNotification(userId, { type: 'calendar_proposal', title: titulo, message: cuerpo, link: '/dashboard/mi-dia' })
        .catch((e: any) => console.error('[propuesta] campana', e?.message));
      // Una propuesta sigue valiendo horas después: si el teléfono está apagado, que espere un día.
      await enviarPush(userId, { titulo, cuerpo, url: '/dashboard/mi-dia', etiqueta: `propuesta-${p.id}` }, 24 * 3600)
        .catch((e: any) => console.error('[propuesta] push', e?.message));
    }
    await avisarUsuarios(rows.map((u: any) => String(u.id)), { titulo, cuerpo, ruta: '/dashboard/mi-dia', hilo: 'propuestas' });
  } catch (e: any) {
    console.error('[propuesta] aviso', e?.message);
  }
}
