import { pool } from '@/lib/db';

/**
 * Zona horaria de los miembros (Ecuador, GMT-5 fijo, sin horario de verano).
 * Igual que en el calendario público / correos. Ver lib/integrations/email.ts.
 */
export const ECUADOR_TZ = 'America/Guayaquil';

/**
 * Convierte una hora de pared en Ecuador (fecha `YYYY-MM-DD` + hora `HH:MM`) a un
 * instante ISO en UTC. Ecuador no tiene DST → offset fijo -05:00, así que es exacto
 * e independiente de la zona del servidor.
 */
export function ecuadorWallclockToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}

/** Formatea un instante en horario de Ecuador: "21 jul 2026 15:15" (independiente del servidor). */
export function formatEcuador(d: Date): string {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${g('day')} ${months[Number(g('month')) - 1]} ${g('year')} ${g('hour')}:${g('minute')}`;
}

/** Formatea una duración en segundos como "1h 37m" (o "0h 5m", "45s" si < 1 min). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Columnas extra de ticket_time_slots para días marcados como "Evento" (con reunión Meet). */
let ensuringSlots: Promise<void> | null = null;
export function ensureTicketSlotColumns(): Promise<void> {
  if (ensuringSlots) return ensuringSlots;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.ticket_time_slots (
        id SERIAL PRIMARY KEY, ticket_id INT NOT NULL, date DATE NOT NULL,
        start_time TEXT, end_time TEXT, status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE gcc_world.ticket_time_slots
        ADD COLUMN IF NOT EXISTS is_event         BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS meeting_url      TEXT,
        ADD COLUMN IF NOT EXISTS meeting_event_id TEXT;
    `)
    .then(() => undefined)
    .catch((err: unknown) => { ensuringSlots = null; throw err; });
  ensuringSlots = p;
  return p;
}

/**
 * Columnas extra de ticket_actions para sesiones en vivo ("inicio ahora"):
 *  - session_started_at / session_ended_at: cronómetro (running = started NOT NULL, ended NULL).
 *  - meeting_url / meeting_event_id: reunión de Google Meet de la sesión.
 *  - calendar_event_id: fila en member_calendar_events (para actualizar fin / borrar al eliminar).
 */
let ensuringActions: Promise<void> | null = null;
export function ensureTicketActionColumns(): Promise<void> {
  if (ensuringActions) return ensuringActions;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.ticket_actions (
        id SERIAL PRIMARY KEY, ticket_id INT NOT NULL, description TEXT NOT NULL,
        cost NUMERIC(12,2) NOT NULL DEFAULT 0, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE gcc_world.ticket_actions
        ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS session_ended_at   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS meeting_url        TEXT,
        ADD COLUMN IF NOT EXISTS meeting_event_id   TEXT,
        ADD COLUMN IF NOT EXISTS calendar_event_id  TEXT;
    `)
    .then(() => undefined)
    .catch((err: unknown) => { ensuringActions = null; throw err; });
  ensuringActions = p;
  return p;
}

export type TicketForSession = {
  id: number;
  member_id: number | null;
  client_id: number | null;
  title: string;
  status: string;
  service_base_price: number | null;
  member_name: string | null;
  member_email: string | null;
  client_name: string | null;
  client_email: string | null;
};

/** Carga el ticket con lo necesario para crear reuniones/sesiones (correos, tarifa, etc.). */
export async function loadTicketForSession(ticketId: string): Promise<TicketForSession | null> {
  const { rows } = await pool.query(
    `SELECT t.id, t.member_id, t.client_id, t.title, t.status,
            s.base_price AS service_base_price,
            m.name AS member_name,
            COALESCE(
              NULLIF(m.email, ''),
              (SELECT u.email FROM gcc_world.users u
                WHERE u.member_id = m.id AND u.email IS NOT NULL AND u.email <> ''
                ORDER BY u.created_at LIMIT 1)
            ) AS member_email,
            c.name AS client_name, c.email AS client_email
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.members m  ON m.id = t.member_id
       LEFT JOIN gcc_world.services s ON s.id = t.service_id
       LEFT JOIN gcc_world.clients c  ON c.id = t.client_id
      WHERE t.id = $1`,
    [ticketId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    member_id: r.member_id != null ? Number(r.member_id) : null,
    client_id: r.client_id != null ? Number(r.client_id) : null,
    title: r.title,
    status: r.status,
    service_base_price: r.service_base_price != null ? Number(r.service_base_price) : null,
    member_name: r.member_name ?? null,
    member_email: r.member_email ?? null,
    client_name: r.client_name ?? null,
    client_email: r.client_email ?? null,
  };
}

/**
 * Guard de autorización compartido: solo el admin o el miembro asignado al ticket
 * pueden gestionar días/acciones/sesiones. Devuelve true si está autorizado.
 */
export async function canManageTicket(
  user: { userId: string; role: string },
  ticketMemberId: number | null,
): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role === 'member' && ticketMemberId != null) {
    const { rows } = await pool.query(
      `SELECT member_id FROM gcc_world.users WHERE id = $1 LIMIT 1`,
      [user.userId],
    );
    const memberId = rows[0]?.member_id != null ? Number(rows[0].member_id) : null;
    return !!memberId && memberId === ticketMemberId;
  }
  return false;
}
