import { pool } from '@/lib/db';
import { ensureReminderTables } from '@/lib/reminders/schema';
import { sendReminderEmail } from '@/lib/integrations/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/**
 * Envía los correos ESCALADOS de los recordatorios activos según cuánto falta para su
 * fecha/hora (`remind_at`). Pensado para correr cada ~10 min (cron):
 *  - ≤ 5 h: 1 correo (una sola vez, al entrar en la banda).
 *  - ≤ 3 h: 1 correo por hora.
 *  - ≤ 30 min: 1 correo cada 10 min.
 *  - al VENCER (t ≤ 0): 1 último correo "vencido" y se detiene (status → 'expired').
 * El destinatario es el dueño del recordatorio (`user_id` → users.email).
 */
export async function runReminderEscalation(): Promise<{ processed: number; sent: number }> {
  await ensureReminderTables();
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.notes, r.remind_at, r.tasks, r.email_stage, r.last_email_at,
            r.expired_email_sent, u.email AS user_email, u.first_name
       FROM gcc_world.reminders r
       JOIN gcc_world.users u ON u.id = r.user_id::uuid
      WHERE r.status = 'active' AND r.remind_at IS NOT NULL
        AND u.email IS NOT NULL AND u.email <> ''`,
  );

  const now = Date.now();
  const link = `${APP_URL}/dashboard/recordatorios`;
  let sent = 0;

  for (const r of rows) {
    const t = new Date(r.remind_at).getTime() - now;              // ms hasta el recordatorio
    const sinceLast = r.last_email_at ? now - new Date(r.last_email_at).getTime() : Infinity;
    const tasks = Array.isArray(r.tasks) ? r.tasks : [];
    const base = { email: r.user_email, name: r.first_name, title: r.title, remindAt: r.remind_at, tasks, notes: r.notes, link };

    try {
      if (t <= 0) {
        if (!r.expired_email_sent) {
          await sendReminderEmail({ ...base, expired: true });
          await pool.query(
            `UPDATE gcc_world.reminders SET expired_email_sent = TRUE, status = 'expired', last_email_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [r.id],
          );
          sent++;
        }
      } else if (t <= 30 * MIN) {
        if (sinceLast >= 9 * MIN) {
          await sendReminderEmail(base);
          await pool.query(`UPDATE gcc_world.reminders SET email_stage = '30min', last_email_at = NOW(), updated_at = NOW() WHERE id = $1`, [r.id]);
          sent++;
        }
      } else if (t <= 3 * HOUR) {
        if (sinceLast >= 55 * MIN) {
          await sendReminderEmail(base);
          await pool.query(`UPDATE gcc_world.reminders SET email_stage = '3h', last_email_at = NOW(), updated_at = NOW() WHERE id = $1`, [r.id]);
          sent++;
        }
      } else if (t <= 5 * HOUR) {
        if (r.email_stage !== '5h') {
          await sendReminderEmail(base);
          await pool.query(`UPDATE gcc_world.reminders SET email_stage = '5h', last_email_at = NOW(), updated_at = NOW() WHERE id = $1`, [r.id]);
          sent++;
        }
      }
      // t > 5 h → aún no se notifica.
    } catch (e: any) {
      console.error(`[reminders] error enviando recordatorio ${r.id}:`, e.message);
    }
  }

  return { processed: rows.length, sent };
}
