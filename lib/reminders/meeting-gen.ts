import { pool } from '@/lib/db';
import { ensureReminderTables } from '@/lib/reminders/schema';
import { ensureCalendarGuestColumns } from '@/lib/calendar/guest';
import { isGoogleWorkspaceConfigured, fetchRecentMeetTranscripts, patchCalendarEventDescription } from '@/lib/integrations/google-workspace';
import { analyzeMeetingTranscript } from '@/lib/reminders/meeting-ai';
import { createNotification } from '@/lib/notifications';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org';
const WINDOW_MS = 48 * 3600 * 1000;
const ORPHAN_STALE_MS = 6 * 3600 * 1000; // sin transcripción tras 6h → se descarta
const MAX_SUBJECTS = 300;               // tope de miembros a escanear por corrida

async function ensureCalReminderColumns() {
  await pool.query(`ALTER TABLE gcc_world.member_calendar_events
    ADD COLUMN IF NOT EXISTS reminder_status VARCHAR(12),
    ADD COLUMN IF NOT EXISTS reminder_id BIGINT`);
}

/** Idempotencia del pase de reuniones INSTANTÁNEAS: una fila por grabación de Meet procesada. */
async function ensureMeetOrphanTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.meet_orphan_records (
    record_name TEXT PRIMARY KEY,
    owner_user_id TEXT,
    reminder_id BIGINT,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    meeting_code TEXT,
    end_time TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

function normalizeMeetCode(url: string): string {
  return (String(url || '').replace(/\/+$/, '').split('/').pop() || '').replace(/-/g, '').toLowerCase();
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
  // Una misma sala puede tener varias reuniones (mismo código): nos quedamos siempre con la
  // transcripción de MÁS texto para no pisar la buena con una sesión vacía.
  const transcripts = await fetchRecentMeetTranscripts(Date.now() - WINDOW_MS);
  const byKey = new Map<string, { text: string }>();
  const put = (k: string, t: { text: string }) => {
    const cur = byKey.get(k);
    if (!cur || (t.text?.length || 0) > (cur.text?.length || 0)) byKey.set(k, t);
  };
  for (const t of transcripts) {
    if (t.meetingUri) put(t.meetingUri.replace(/\/+$/, ''), t);
    if (t.meetingCode) put(t.meetingCode.replace(/-/g, '').toLowerCase(), t);
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

/**
 * Reuniones de Meet INSTANTÁNEAS ("iniciar ahora", sin evento de calendario). Impersona a
 * cada miembro con cuenta corporativa (`workspace_email`), lista SUS grabaciones de Meet en
 * las últimas 48h, descarta las que ya son eventos de calendario (las maneja
 * `runMeetingReminderGeneration`) y, para las huérfanas con transcripción lista, crea un
 * recordatorio (`source='meeting'`) a nombre de ese miembro con la transcripción `.txt`
 * adjunta. Idempotente vía `meet_orphan_records` (una fila por grabación); si no hay
 * transcripción se reintenta y se descarta pasadas 6h.
 */
export async function runInstantMeetingReminderGeneration(): Promise<{ subjects: number; processed: number; created: number; note?: string }> {
  if (!isGoogleWorkspaceConfigured()) return { subjects: 0, processed: 0, created: 0, note: 'google-not-configured' };
  await ensureReminderTables();
  await ensureMeetOrphanTable();

  // Miembros con cuenta corporativa: se impersona a cada uno para leer SUS reuniones de Meet.
  const { rows: subjects } = await pool.query(
    `SELECT id, workspace_email FROM gcc_world.users
      WHERE member_id IS NOT NULL AND workspace_email IS NOT NULL AND workspace_email <> ''
      ORDER BY id LIMIT $1`,
    [MAX_SUBJECTS],
  );
  if (subjects.length === 0) return { subjects: 0, processed: 0, created: 0 };

  // Códigos de reuniones que YA son eventos de calendario (últimas 48h): se saltan para no
  // duplicar con el pase de reuniones agendadas.
  const { rows: evRows } = await pool.query(
    `SELECT meeting_url FROM gcc_world.member_calendar_events
      WHERE meeting_url IS NOT NULL AND end_at > NOW() - INTERVAL '48 hours'`,
  );
  const scheduledCodes = new Set<string>();
  for (const e of evRows) { const c = normalizeMeetCode(e.meeting_url); if (c) scheduledCodes.add(c); }

  const sinceMs = Date.now() - WINDOW_MS;
  let processed = 0, created = 0;

  for (const s of subjects) {
    let transcripts: Awaited<ReturnType<typeof fetchRecentMeetTranscripts>>;
    try {
      transcripts = await fetchRecentMeetTranscripts(sinceMs, s.workspace_email);
    } catch (e: any) {
      console.error('[instant-gen] fetch error', s.workspace_email, e.message);
      continue;
    }

    for (const tr of transcripts) {
      if (!tr.recordName) continue;
      const code = (tr.meetingCode || '').replace(/-/g, '').toLowerCase();
      if (code && scheduledCodes.has(code)) continue; // es una reunión agendada
      processed++;

      const { rows: [existing] } = await pool.query(
        `SELECT status FROM gcc_world.meet_orphan_records WHERE record_name = $1`, [tr.recordName],
      );
      if (existing && (existing.status === 'done' || existing.status === 'skip')) continue;

      if (!tr.text) {
        // Sin transcripción todavía: registrar/seguir en pending; descartar tras 6h del fin.
        const endMs = tr.endTime ? new Date(tr.endTime).getTime() : Date.now();
        const stale = Date.now() - endMs > ORPHAN_STALE_MS;
        await pool.query(
          `INSERT INTO gcc_world.meet_orphan_records (record_name, owner_user_id, status, meeting_code, end_time)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (record_name) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
          [tr.recordName, s.id, stale ? 'skip' : 'pending', code || null, tr.endTime || null],
        );
        continue;
      }

      let analysis;
      try {
        analysis = await analyzeMeetingTranscript(tr.text, {
          meetingTitle: 'Reunión de Meet',
          meetingEndISO: (tr.endTime ? new Date(tr.endTime) : new Date()).toISOString(),
        });
      } catch (e: any) {
        console.error('[instant-gen] IA error', tr.recordName, e.message);
        continue; // se reintenta en la próxima corrida (queda 'pending' si ya existe la fila)
      }

      const { rows: [r] } = await pool.query(
        `INSERT INTO gcc_world.reminders (user_id, title, notes, remind_at, tasks, status, source, source_event_id, created_by)
         VALUES ($1, $2, $3, $4, $5, 'active', 'meeting', $6, $1) RETURNING id`,
        [s.id, analysis.title, analysis.notes || null, analysis.remind_at, JSON.stringify(analysis.tasks), tr.recordName],
      );

      const txtData = 'data:text/plain;base64,' + Buffer.from(tr.text, 'utf8').toString('base64');
      await pool.query(
        `INSERT INTO gcc_world.reminder_attachments (reminder_id, filename, content_type, kind, data, size)
         VALUES ($1, 'transcripcion-reunion.txt', 'text/plain', 'transcript', $2, $3)`,
        [r.id, txtData, Buffer.byteLength(tr.text, 'utf8')],
      );

      await pool.query(
        `INSERT INTO gcc_world.meet_orphan_records (record_name, owner_user_id, reminder_id, status, meeting_code, end_time)
         VALUES ($1, $2, $3, 'done', $4, $5)
         ON CONFLICT (record_name) DO UPDATE SET status = 'done', reminder_id = EXCLUDED.reminder_id, updated_at = NOW()`,
        [tr.recordName, s.id, r.id, code || null, tr.endTime || null],
      );

      const link = `${APP_URL}/dashboard/recordatorios?open=${r.id}`;
      try {
        await createNotification(s.id, { type: 'reminder', title: `Recordatorio de reunión: ${analysis.title}`, message: 'Generado de una reunión de Meet', link });
      } catch { /* no bloquea */ }

      created++;
    }
  }

  return { subjects: subjects.length, processed, created };
}
