import { pool } from '@/lib/db';
import { ensureReminderTables } from '@/lib/reminders/schema';
import { ensureCalendarGuestColumns } from '@/lib/calendar/guest';
import { isGoogleWorkspaceConfigured, fetchRecentMeetTranscripts, patchCalendarEventDescription } from '@/lib/integrations/google-workspace';
import { analyzeMeetingTranscript } from '@/lib/reminders/meeting-ai';
import { createNotification } from '@/lib/notifications';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';
const WINDOW_MS = 48 * 3600 * 1000;

async function ensureCalReminderColumns() {
  await pool.query(`ALTER TABLE gcc_world.member_calendar_events
    ADD COLUMN IF NOT EXISTS reminder_status VARCHAR(12),
    ADD COLUMN IF NOT EXISTS reminder_id BIGINT`);
}

/**
 * Detecta reuniones de Meet TERMINADAS (evento del calendario con `meeting_url` cuyo fin ya
 * pasó, en las últimas 48h y sin recordatorio) → obtiene la transcripción → la analiza con IA
 * → crea el recordatorio (`source='meeting'`) con la transcripción `.txt` adjunta → agrega en
 * la descripción del evento un enlace al recordatorio. El dueño es el miembro del evento.
 */
export async function runMeetingReminderGeneration(): Promise<{ processed: number; created: number; note?: string }> {
  if (!isGoogleWorkspaceConfigured()) return { processed: 0, created: 0, note: 'google-not-configured' };
  await ensureReminderTables();
  await ensureCalendarGuestColumns();
  await ensureCalReminderColumns();

  const { rows: events } = await pool.query(
    `SELECT e.id, e.title, e.description, e.end_at, e.meeting_url, e.meeting_event_id, e.member_id
       FROM gcc_world.member_calendar_events e
      WHERE e.meeting_url IS NOT NULL AND e.member_id IS NOT NULL
        AND e.end_at < NOW() AND e.end_at > NOW() - INTERVAL '48 hours'
        AND (e.reminder_status IS NULL OR e.reminder_status = 'pending')
      ORDER BY e.end_at DESC`,
  );
  if (events.length === 0) return { processed: 0, created: 0 };

  // Trae las transcripciones recientes una sola vez y mapea por meetingUri y por meetingCode.
  const transcripts = await fetchRecentMeetTranscripts(Date.now() - WINDOW_MS);
  const byKey = new Map<string, { text: string }>();
  for (const t of transcripts) {
    if (t.meetingUri) byKey.set(t.meetingUri.replace(/\/+$/, ''), t);
    if (t.meetingCode) byKey.set(t.meetingCode.replace(/-/g, '').toLowerCase(), t);
  }

  let created = 0;
  for (const ev of events) {
    const url = String(ev.meeting_url || '').replace(/\/+$/, '');
    const code = (url.split('/').pop() || '').replace(/-/g, '').toLowerCase();
    const tr = byKey.get(url) || byKey.get(code);

    if (!tr || !tr.text) {
      // Sin transcripción aún: reintentar; pero si el evento terminó hace >6h, se descarta.
      const stale = Date.now() - new Date(ev.end_at).getTime() > 6 * 3600 * 1000;
      await pool.query(`UPDATE gcc_world.member_calendar_events SET reminder_status = $1 WHERE id = $2`, [stale ? 'skip' : 'pending', ev.id]);
      continue;
    }

    const { rows: [u] } = await pool.query(
      `SELECT id FROM gcc_world.users WHERE member_id = $1 ORDER BY created_at LIMIT 1`, [ev.member_id],
    );
    if (!u?.id) { await pool.query(`UPDATE gcc_world.member_calendar_events SET reminder_status='skip' WHERE id=$1`, [ev.id]); continue; }

    let analysis;
    try {
      analysis = await analyzeMeetingTranscript(tr.text, { meetingTitle: ev.title, meetingEndISO: new Date(ev.end_at).toISOString() });
    } catch (e: any) {
      console.error('[meeting-gen] IA error', ev.id, e.message);
      continue; // se reintenta en la próxima corrida (queda 'pending')
    }

    const { rows: [r] } = await pool.query(
      `INSERT INTO gcc_world.reminders (user_id, title, notes, remind_at, tasks, status, source, source_event_id, created_by)
       VALUES ($1, $2, $3, $4, $5, 'active', 'meeting', $6, $1) RETURNING id`,
      [u.id, analysis.title, analysis.notes || null, analysis.remind_at, JSON.stringify(analysis.tasks), String(ev.id)],
    );

    const txtData = 'data:text/plain;base64,' + Buffer.from(tr.text, 'utf8').toString('base64');
    await pool.query(
      `INSERT INTO gcc_world.reminder_attachments (reminder_id, filename, content_type, kind, data, size)
       VALUES ($1, $2, 'text/plain', 'transcript', $3, $4)`,
      [r.id, `transcripcion-reunion-${ev.id}.txt`, txtData, Buffer.byteLength(tr.text, 'utf8')],
    );

    // Enlace al recordatorio en la descripción del evento (Mi día) + Google Calendar (best-effort).
    const link = `${APP_URL}/dashboard/recordatorios?open=${r.id}`;
    const desc = String(ev.description || '');
    const newDesc = desc.includes('/dashboard/recordatorios?open=') ? desc : `${desc}${desc ? '\n\n' : ''}📌 Recordatorio de esta reunión: ${link}`;
    await pool.query(`UPDATE gcc_world.member_calendar_events SET description = $1, reminder_status = 'done', reminder_id = $2 WHERE id = $3`, [newDesc, r.id, ev.id]);
    if (ev.meeting_event_id) { try { await patchCalendarEventDescription(ev.meeting_event_id, newDesc); } catch (e: any) { console.error('[meeting-gen] cal patch', e.message); } }

    try {
      await createNotification(u.id, { type: 'reminder', title: `Recordatorio de reunión: ${analysis.title}`, message: `Generado de "${ev.title}"`, link });
    } catch { /* no bloquea */ }

    created++;
  }

  return { processed: events.length, created };
}
