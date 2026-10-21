import { pool } from '@/lib/db';
import { SCOPE_CALENDAR, leerGoogle, enlaceDe, esVisible, horasDe, proveedorDe, olvidarProximas } from '@/lib/calendar/google';

/**
 * ⇒ REUNIONES DE GOOGLE → REUNIONES REGISTRADAS EN MI DÍA (Fernando, 2026-10-20).
 *
 * Las invitaciones que llegan a la cuenta de Google de cada persona (la de Configuración →
 * Conexiones) se guardan como eventos de Mi día a esa hora, con su enlace de videollamada: así
 * cuentan como cualquier reunión (avisos, iCal, horas, recordatorio desde la transcripción).
 *
 * - Reunión = evento con hora (no de día completo) que tiene videollamada o más invitados que
 *   uno mismo, ni cancelado ni rechazado. Lo demás de Google se sigue pintando en vivo
 *   (`lib/calendar/google.ts`), sin copiarse.
 * - La hora se guarda en la zona del calendario de la PERSONA, no en la del organizador.
 * - Ventana: los últimos 7 días y los próximos 60. Cada 10 min en el servidor y al abrir Mi día (2 min
 *   como mínimo entre pasadas por persona).
 * - Google manda en lo suyo: título, horas, descripción y enlace se reescriben SOLO cuando el
 *   evento cambia allá (`google_updated`); lo que la persona toque aquí se conserva hasta entonces.
 * - Si allá se cancela, se rechaza o se borra una reunión que aún no empieza, aquí se quita
 *   (o se marca cancelada si ya tiene recordatorio). Las pasadas no se tocan: quedan de registro.
 *   Sin leer todas las páginas no se quita nada.
 * - Eliminarla en Mi día la descarta (`google_eventos_descartados`): no vuelve a entrar. Nunca
 *   se borra nada en Google (`meeting_event_id` queda NULL: es solo para los Meet que crea GCC).
 * - Cada fila lleva QUÉ cuenta la trajo (`google_user_id`): con dos cuentas en el mismo miembro,
 *   una no quita lo que trajo la otra.
 */

const DIA = 86400_000;
const ATRAS_DIAS = 7;
const VENTANA_DIAS = 60;
const MIN_ENTRE_PASADAS = 2 * 60_000;

let asegurando: Promise<void> | null = null;
export function asegurarColumnasImportacion(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      ALTER TABLE gcc_world.member_calendar_events
        ADD COLUMN IF NOT EXISTS google_event_id TEXT,
        ADD COLUMN IF NOT EXISTS google_user_id UUID,
        ADD COLUMN IF NOT EXISTS google_updated TIMESTAMPTZ;
      CREATE UNIQUE INDEX IF NOT EXISTS member_calendar_events_google_uidx
        ON gcc_world.member_calendar_events (member_id, google_event_id) WHERE google_event_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS gcc_world.google_eventos_descartados (
        member_id BIGINT NOT NULL,
        google_event_id TEXT NOT NULL,
        descartado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (member_id, google_event_id)
      );
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

/** ¿Es una reunión? Con hora, y con videollamada o con alguien más invitado. */
export function esReunion(g: any): boolean {
  if (!esVisible(g) || g.start?.date || g.eventType === 'focusTime') return false;
  return !!enlaceDe(g) || (g.attendees || []).some((a: any) => !a.self && !a.resource);
}

/** La descripción de Google viene en HTML: aquí va en texto. */
function textoPlano(html: string | undefined): string | null {
  if (!html) return null;
  const t = html
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/^[ \t]*[_\-=]{5,}[ \t]*$/gm, '')  // las rayas de la plantilla de Teams/Outlook
    .replace(/\n{3,}/g, '\n\n').trim();
  return t ? t.slice(0, 4000) : null;
}

export type ResultadoImportacion = { estado: string; nuevas: number; actualizadas: number; quitadas: number };

const ultima = new Map<string, number>();

export async function importarReunionesGoogle(userId: string, opts: { forzar?: boolean } = {}): Promise<ResultadoImportacion> {
  const nada = (estado: string): ResultadoImportacion => ({ estado, nuevas: 0, actualizadas: 0, quitadas: 0 });
  const ahora = Date.now();
  if (!opts.forzar && (ultima.get(userId) || 0) + MIN_ENTRE_PASADAS > ahora) return nada('reciente');
  ultima.set(userId, ahora);

  await asegurarColumnasImportacion();
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  if (!u?.member_id) return nada('sin_miembro');
  const memberId = String(u.member_id);

  const desde = new Date(ahora - ATRAS_DIAS * DIA), hasta = new Date(ahora + VENTANA_DIAS * DIA);
  const leido = await leerGoogle(userId, desde, hasta);
  if (leido.estado !== 'ok') return nada(leido.estado);

  // Lo que GCC creó (Meet de propuestas aceptadas) ya está en Mi día por su lado.
  const deGcc = await (async () => {
    const { rows } = await pool.query(
      `SELECT meeting_event_id, meeting_url FROM gcc_world.member_calendar_events
        WHERE member_id = $1 AND google_event_id IS NULL AND (meeting_event_id IS NOT NULL OR meeting_url IS NOT NULL)`,
      [memberId],
    );
    const ids = new Set(rows.map((r: any) => r.meeting_event_id).filter(Boolean));
    const enlaces = new Set(rows.map((r: any) => r.meeting_url).filter(Boolean));
    return (g: any) => ids.has(g.id) || ids.has(g.recurringEventId) || (!!enlaceDe(g) && enlaces.has(enlaceDe(g)));
  })();
  const { rows: desc } = await pool.query(
    `SELECT google_event_id FROM gcc_world.google_eventos_descartados WHERE member_id = $1`, [memberId],
  );
  const descartados = new Set(desc.map((d: any) => d.google_event_id));

  const vigentes = new Set<string>();
  let nuevas = 0, actualizadas = 0;
  for (const g of leido.crudos) {
    if (!g.id || !esReunion(g) || deGcc(g)) continue;
    vigentes.add(g.id);
    if (descartados.has(g.id)) continue;
    const h = horasDe(g, leido.zona);
    if (!h || h.fin <= h.ini) continue;
    const enlace = enlaceDe(g);
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.member_calendar_events (
         member_id, title, description, event_type, start_at, end_at, all_day, timezone,
         status, created_by, meeting_url, meeting_provider, google_event_id, google_user_id, google_updated
       ) VALUES ($1, $2, $3, 'progreso', $4, $5, false, $6, 'confirmed', $7, $8, $9, $10, $7, $11)
       ON CONFLICT (member_id, google_event_id) WHERE google_event_id IS NOT NULL DO UPDATE SET
         title = EXCLUDED.title, description = EXCLUDED.description,
         start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at, timezone = EXCLUDED.timezone,
         meeting_url = EXCLUDED.meeting_url, meeting_provider = EXCLUDED.meeting_provider,
         google_user_id = EXCLUDED.google_user_id, google_updated = EXCLUDED.google_updated,
         status = 'confirmed', updated_at = now()
       WHERE gcc_world.member_calendar_events.google_updated IS DISTINCT FROM EXCLUDED.google_updated
          OR gcc_world.member_calendar_events.status = 'cancelled'
       RETURNING (xmax = 0) AS nueva`,
      [
        memberId, (g.summary || '(Sin título)').slice(0, 255), textoPlano(g.description),
        h.ini.toISOString(), h.fin.toISOString(), leido.zona,
        userId, enlace, proveedorDe(enlace), g.id, g.updated || null,
      ],
    );
    if (rows[0]) { if (rows[0].nueva) nuevas++; else actualizadas++; }
  }

  // Lo que allá ya no es una reunión vigente y aquí aún no empieza.
  let quitadas = 0;
  if (leido.completo) {
    const { rows: mias } = await pool.query(
      `SELECT id, google_event_id, reminder_id FROM gcc_world.member_calendar_events
        WHERE member_id = $1 AND google_user_id = $2 AND google_event_id IS NOT NULL
          AND status <> 'cancelled' AND start_at > now() AND start_at < $3`,
      [memberId, userId, hasta],
    );
    for (const m of mias.filter((x: any) => !vigentes.has(x.google_event_id))) {
      if (m.reminder_id) await pool.query(`UPDATE gcc_world.member_calendar_events SET status = 'cancelled', updated_at = now() WHERE id = $1`, [m.id]);
      else await pool.query(`DELETE FROM gcc_world.member_calendar_events WHERE id = $1`, [m.id]);
      quitadas++;
    }
  }

  if (nuevas || actualizadas || quitadas) olvidarProximas(userId);
  return { estado: 'ok', nuevas, actualizadas, quitadas };
}

/** Todas las personas con Google Calendar conectado (el trabajo de cada 10 min). Nunca lanza. */
export async function importarTodasLasReuniones(): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT g.user_id FROM gcc_world.google_conexiones g
         JOIN gcc_world.users u ON u.id = g.user_id
        WHERE g.estado = 'activa' AND $1 = ANY(g.scopes) AND u.member_id IS NOT NULL`,
      [SCOPE_CALENDAR],
    );
    for (const r of rows) {
      try { await importarReunionesGoogle(String(r.user_id), { forzar: true }); }
      catch (e: any) { console.error('[google-import]', r.user_id, e?.message); }
    }
  } catch (e: any) {
    console.error('[google-import]', e?.message);
  }
}
