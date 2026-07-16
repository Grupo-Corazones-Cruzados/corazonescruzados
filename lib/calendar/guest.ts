import { pool } from '@/lib/db';

/**
 * Columnas extra de `member_calendar_events`:
 *  - `guest_email`/`guest_name`: propuestas de visitantes EXTERNOS/anónimos del
 *    calendario público (sin cuenta); `created_by` queda NULL en esos casos.
 *  - `meeting_url`/`meeting_provider`: enlace de la reunión creada al aceptar la
 *    propuesta (hoy Google Meet). Se guarda para reenviarlo y evitar recrearlo.
 * Idempotente y serializado con un promise singleton (varios endpoints pueden
 * llamarlo en paralelo).
 */
let ensuring: Promise<void> | null = null;

export function ensureCalendarGuestColumns(): Promise<void> {
  if (!ensuring) {
    const p = pool
      .query(`
        ALTER TABLE gcc_world.member_calendar_events
          ADD COLUMN IF NOT EXISTS guest_email      TEXT,
          ADD COLUMN IF NOT EXISTS guest_name       TEXT,
          ADD COLUMN IF NOT EXISTS meeting_url      TEXT,
          ADD COLUMN IF NOT EXISTS meeting_provider TEXT
      `)
      .then(() => undefined)
      .catch((err: unknown) => { ensuring = null; throw err; });
    ensuring = p;
    return p;
  }
  return ensuring;
}
