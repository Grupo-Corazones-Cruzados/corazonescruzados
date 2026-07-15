import { pool } from '@/lib/db';

/**
 * Columnas para propuestas de agendamiento hechas por visitantes EXTERNOS/anónimos
 * del calendario público (sin cuenta): guardan su correo y nombre. `created_by`
 * queda NULL en esos casos. Idempotente y serializado con un promise singleton
 * (varios endpoints públicos pueden llamarlo en paralelo).
 */
let ensuring: Promise<void> | null = null;

export function ensureCalendarGuestColumns(): Promise<void> {
  if (!ensuring) {
    const p = pool
      .query(`
        ALTER TABLE gcc_world.member_calendar_events
          ADD COLUMN IF NOT EXISTS guest_email TEXT,
          ADD COLUMN IF NOT EXISTS guest_name  TEXT
      `)
      .then(() => undefined)
      .catch((err: unknown) => { ensuring = null; throw err; });
    ensuring = p;
    return p;
  }
  return ensuring;
}
