import { pool } from '@/lib/db';
import { ensureReminderTables } from '@/lib/reminders/schema';
import { sendReminderEmail } from '@/lib/integrations/email';
import { avisarUsuarios } from '@/lib/push/avisos';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/**
 * El mismo aviso, al TELÉFONO (Fernando, 2026-10-07: «que la app notifique recordatorios
 * usando el mismo sistema de tiempos que ya tenemos»). Sale en los mismos momentos que el
 * correo y solo después de que el correo salió: si el correo falla, la etapa no avanza, se
 * reintenta en la siguiente vuelta y el teléfono no recibe dos veces el mismo aviso.
 */
function avisoAlTelefono(r: { user_id: string; title: string; remind_at: string | Date }, restanteMs: number) {
  const hora = new Date(r.remind_at).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' });
  let cuando: string;
  if (restanteMs <= 0) cuando = `Venció a las ${hora}`;
  else if (restanteMs < HOUR) cuando = `En ${Math.max(1, Math.round(restanteMs / MIN))} min · a las ${hora}`;
  else {
    const h = Math.floor(restanteMs / HOUR); const m = Math.round((restanteMs % HOUR) / MIN);
    cuando = `En ${h} h${m ? ` ${m} min` : ''} · a las ${hora}`;
  }
  return avisarUsuarios([r.user_id], { titulo: r.title || 'Recordatorio', cuerpo: cuando, ruta: '/dashboard/recordatorios' });
}

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
            r.expired_email_sent, r.user_id, u.email AS user_email, u.first_name
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
          await avisoAlTelefono(r, t);
          sent++;
        }
      } else if (t <= 30 * MIN) {
        if (sinceLast >= 9 * MIN) {
          await sendReminderEmail(base);
          await pool.query(`UPDATE gcc_world.reminders SET email_stage = '30min', last_email_at = NOW(), updated_at = NOW() WHERE id = $1`, [r.id]);
          await avisoAlTelefono(r, t);
          sent++;
        }
      } else if (t <= 3 * HOUR) {
        if (sinceLast >= 55 * MIN) {
          await sendReminderEmail(base);
          await pool.query(`UPDATE gcc_world.reminders SET email_stage = '3h', last_email_at = NOW(), updated_at = NOW() WHERE id = $1`, [r.id]);
          await avisoAlTelefono(r, t);
          sent++;
        }
      } else if (t <= 5 * HOUR) {
        if (r.email_stage !== '5h') {
          await sendReminderEmail(base);
          await pool.query(`UPDATE gcc_world.reminders SET email_stage = '5h', last_email_at = NOW(), updated_at = NOW() WHERE id = $1`, [r.id]);
          await avisoAlTelefono(r, t);
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
