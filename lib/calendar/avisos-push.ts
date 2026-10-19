import { pool } from '@/lib/db';
import type { CalendarEvent } from '@/lib/calendar/recurrence';
import { avisosPendientes, claveAviso, textoAviso, UMBRALES } from '@/lib/calendar/avisos';
import { asegurarTablaPush, enviarPush } from '@/lib/push';

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
 * Solo mira a quien tiene algún dispositivo suscrito: sin suscripción no hay a quién mandar.
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
          AND EXISTS (SELECT 1 FROM gcc_world.push_suscripciones s WHERE s.user_id = u.id)
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
