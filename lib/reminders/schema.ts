import { pool } from '@/lib/db';

/**
 * Módulo RECORDATORIOS. Un recordatorio pertenece a un usuario (`user_id`, el miembro/
 * candidato que lo recibe), tiene título, fecha/hora (`remind_at`), una lista de tareas y
 * adjuntos. Puede crearse manualmente o generarse desde una reunión de Google Meet
 * (`source='meeting'`, `source_event_id` = evento del calendario). Los correos escalados y
 * la generación automática se manejan en fases posteriores (columnas `email_stage`/`last_email_at`).
 */
let ensuring: Promise<void> | null = null;
export function ensureReminderTables(): Promise<void> {
  if (ensuring) return ensuring;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.reminders (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        remind_at TIMESTAMPTZ,
        tasks JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        source VARCHAR(20) NOT NULL DEFAULT 'manual',
        source_event_id TEXT,
        email_stage VARCHAR(24),
        last_email_at TIMESTAMPTZ,
        expired_email_sent BOOLEAN NOT NULL DEFAULT FALSE,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gcc_world.reminder_attachments (
        id BIGSERIAL PRIMARY KEY,
        reminder_id BIGINT NOT NULL,
        filename TEXT NOT NULL,
        content_type TEXT,
        kind VARCHAR(20) NOT NULL DEFAULT 'file',
        data TEXT,
        size INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_user ON gcc_world.reminders(user_id);
      CREATE INDEX IF NOT EXISTS idx_reminder_att ON gcc_world.reminder_attachments(reminder_id);
    `)
    .then(() => undefined)
    .catch((err: unknown) => { ensuring = null; throw err; });
  ensuring = p;
  return p;
}

export type ReminderTask = { id: string; text: string; done: boolean };

/** Normaliza la lista de tareas recibida del cliente a { id, text, done }. */
export function normalizeTasks(raw: any): ReminderTask[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: any, i: number) => {
      if (typeof t === 'string') return { id: `t${i}`, text: t.trim(), done: false };
      return { id: String(t?.id || `t${i}`), text: String(t?.text || '').trim(), done: !!t?.done };
    })
    .filter((t: ReminderTask) => t.text);
}
