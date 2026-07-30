import { pool } from '@/lib/db';
import { ensureReminderTables } from '@/lib/reminders/schema';
import {
  isGoogleWorkspaceConfigured,
  fetchRecentMeetTranscripts,
  fetchMeetRecord,
  fetchMeetTranscriptText,
} from '@/lib/integrations/google-workspace';
import {
  createMeetingReminder,
  ensureCalReminderColumns,
  ensureMeetOrphanTable,
  normalizeMeetCode,
} from '@/lib/reminders/meeting-gen';

/**
 * Generación MANUAL de recordatorios de reunión (botón "Buscar reuniones" del módulo
 * Recordatorios). Existe porque el pase automático depende del cron y de que Google libere
 * la transcripción a tiempo: con esto el miembro busca sus reuniones recientes de Meet —
 * sobre todo las **instantáneas** ("iniciar ahora"), que no son eventos del calendario — y
 * genera el recordatorio cuando quiere.
 *
 * Se impersona SIEMPRE la cuenta corporativa del propio usuario (`users.workspace_email`):
 * cada uno solo ve y genera sobre SUS reuniones.
 */

export const SCAN_DAY_OPTIONS = [2, 7, 30] as const;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

export type MeetingCandidateState = 'ready' | 'no-transcript' | 'generated';

export interface MeetingCandidate {
  recordName: string;
  meetingCode: string | null;
  meetingUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Duración en minutos (redondeada), o null si falta alguna marca de tiempo. */
  minutes: number | null;
  /** Título del evento del calendario, o "Reunión instantánea" si no está agendada. */
  title: string;
  /** `scheduled` = tiene evento en Mi día · `instant` = iniciada sin agendar. */
  kind: 'scheduled' | 'instant';
  calendarEventId: string | null;
  state: MeetingCandidateState;
  /** Recordatorio ya generado para esta reunión, si existe. */
  reminderId: number | null;
}

/** Eventos del calendario del miembro con reunión de Meet dentro de la ventana, por código. */
async function loadEventsByCode(memberId: string | number | null, sinceMs: number) {
  const byCode = new Map<string, { id: string; title: string; description: string | null; meeting_event_id: string | null; end_at: string; reminder_id: number | null }>();
  if (memberId == null) return byCode;
  const { rows } = await pool.query(
    `SELECT id, title, description, meeting_event_id, end_at, reminder_id, meeting_url
       FROM gcc_world.member_calendar_events
      WHERE member_id = $1 AND meeting_url IS NOT NULL AND end_at > $2`,
    [memberId, new Date(sinceMs).toISOString()],
  );
  for (const e of rows) {
    const code = normalizeMeetCode(e.meeting_url);
    if (code) byCode.set(code, e);
  }
  return byCode;
}

/** Cuenta corporativa + member_id del usuario; `workspace_email` es obligatorio para leer Meet. */
async function loadSubject(userId: string): Promise<{ workspaceEmail: string | null; memberId: string | null }> {
  const { rows: [u] } = await pool.query(
    `SELECT workspace_email, member_id FROM gcc_world.users WHERE id = $1`, [userId],
  );
  return { workspaceEmail: u?.workspace_email || null, memberId: u?.member_id ?? null };
}

export function normalizeDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAYS;
  return Math.min(Math.round(n), MAX_DAYS);
}

/**
 * Lista las reuniones de Meet del usuario en los últimos `days` días, marcando para cada una
 * si ya tiene recordatorio, si la transcripción está lista, y si estaba agendada o no.
 * NO baja el texto de las transcripciones (solo su disponibilidad) para que el listado sea rápido.
 */
export async function scanUserMeetings(
  userId: string,
  days = DEFAULT_DAYS,
): Promise<{ candidates: MeetingCandidate[]; workspaceEmail: string | null; note?: string }> {
  if (!isGoogleWorkspaceConfigured()) return { candidates: [], workspaceEmail: null, note: 'google-not-configured' };
  await ensureReminderTables();
  await ensureCalReminderColumns();
  await ensureMeetOrphanTable();

  const { workspaceEmail, memberId } = await loadSubject(userId);
  if (!workspaceEmail) return { candidates: [], workspaceEmail: null, note: 'no-workspace-email' };

  const sinceMs = Date.now() - days * 24 * 3600 * 1000;
  const records = await fetchRecentMeetTranscripts(sinceMs, workspaceEmail, { withText: false });
  if (records.length === 0) return { candidates: [], workspaceEmail };

  const eventsByCode = await loadEventsByCode(memberId, sinceMs);

  // Recordatorios ya generados para estas grabaciones: por `meet_orphan_records` (instantáneas)
  // y por `reminders.source_event_id` (que guarda el recordName o el id del evento).
  const names = records.map((r) => r.recordName).filter(Boolean) as string[];
  const doneByRecord = new Map<string, number>();
  if (names.length) {
    const { rows } = await pool.query(
      `SELECT record_name, reminder_id FROM gcc_world.meet_orphan_records
        WHERE record_name = ANY($1::text[]) AND status = 'done' AND reminder_id IS NOT NULL`,
      [names],
    );
    for (const r of rows) doneByRecord.set(r.record_name, Number(r.reminder_id));
    const { rows: rem } = await pool.query(
      `SELECT id, source_event_id FROM gcc_world.reminders
        WHERE source = 'meeting' AND source_event_id = ANY($1::text[])`,
      [names],
    );
    for (const r of rem) if (!doneByRecord.has(r.source_event_id)) doneByRecord.set(r.source_event_id, Number(r.id));
  }

  const candidates: MeetingCandidate[] = [];
  for (const rec of records) {
    if (!rec.recordName) continue;
    const code = (rec.meetingCode || '').replace(/-/g, '').toLowerCase();
    const ev = code ? eventsByCode.get(code) : undefined;

    const ownReminderId = doneByRecord.get(rec.recordName) ?? null;
    const reminderId = ownReminderId ?? (ev?.reminder_id ? Number(ev.reminder_id) : null);
    const minutes = rec.startTime && rec.endTime
      ? Math.max(0, Math.round((new Date(rec.endTime).getTime() - new Date(rec.startTime).getTime()) / 60000))
      : null;

    // "Falso arranque": se entró y se salió en segundos, sin transcripción y sin recordatorio
    // propio. Meet crea una grabación por CADA entrada a la sala, así que una reunión normal
    // deja 2-3 de estas y ensucian el listado. No hay nada que generar con ellas.
    if (!ownReminderId && !rec.hasTranscript && minutes !== null && minutes < 1) continue;

    candidates.push({
      recordName: rec.recordName,
      meetingCode: rec.meetingCode,
      meetingUrl: rec.meetingUri,
      startTime: rec.startTime,
      endTime: rec.endTime,
      minutes,
      title: ev?.title || 'Reunión instantánea',
      kind: ev ? 'scheduled' : 'instant',
      calendarEventId: ev?.id || null,
      state: reminderId ? 'generated' : rec.hasTranscript ? 'ready' : 'no-transcript',
      reminderId,
    });
  }

  candidates.sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime());
  return { candidates, workspaceEmail };
}

export class MeetingScanError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/**
 * Genera el recordatorio de UNA reunión elegida a mano. Idempotente: si esa grabación ya tiene
 * recordatorio, devuelve el existente sin volver a llamar a la IA.
 */
export async function generateReminderFromRecord(
  userId: string,
  recordName: string,
): Promise<{ reminderId: number; title: string; alreadyExisted: boolean }> {
  if (!isGoogleWorkspaceConfigured()) throw new MeetingScanError('Google Workspace no está configurado', 503);
  if (!/^conferenceRecords\/[A-Za-z0-9_-]+$/.test(recordName)) throw new MeetingScanError('Grabación inválida', 400);

  await ensureReminderTables();
  await ensureCalReminderColumns();
  await ensureMeetOrphanTable();

  const { workspaceEmail, memberId } = await loadSubject(userId);
  if (!workspaceEmail) throw new MeetingScanError('Tu usuario no tiene cuenta corporativa @grupocc.org vinculada', 400);

  // Ya generado (por el cron o por un clic anterior) → devolver el mismo recordatorio.
  const { rows: [existing] } = await pool.query(
    `SELECT r.id, r.title FROM gcc_world.reminders r
      WHERE r.source = 'meeting' AND r.source_event_id = $1 AND r.user_id = $2
      ORDER BY r.id DESC LIMIT 1`,
    [recordName, userId],
  );
  if (existing) return { reminderId: Number(existing.id), title: existing.title, alreadyExisted: true };

  // `get` impersonando al propio usuario: si la reunión no es suya, Google responde 403/404.
  const rec = await fetchMeetRecord(recordName, workspaceEmail);
  if (!rec) throw new MeetingScanError('No se encontró esa reunión en tu cuenta de Meet', 404);

  const transcript = await fetchMeetTranscriptText(recordName, workspaceEmail);
  if (!transcript) {
    throw new MeetingScanError(
      'Esa reunión todavía no tiene transcripción disponible. Google puede tardar unos minutos en liberarla; ' +
      'si la reunión se hizo sin transcripción activada, no es posible generar el recordatorio.',
      409,
    );
  }

  const code = (rec.meetingCode || '').replace(/-/g, '').toLowerCase();
  const sinceMs = new Date(rec.endTime || Date.now()).getTime() - 24 * 3600 * 1000;
  const eventsByCode = await loadEventsByCode(memberId, sinceMs);
  const ev = code ? eventsByCode.get(code) : undefined;

  // Si la reunión SÍ estaba agendada y su evento ya tiene recordatorio, no se duplica.
  if (ev?.reminder_id) {
    const { rows: [r] } = await pool.query(`SELECT id, title FROM gcc_world.reminders WHERE id = $1`, [ev.reminder_id]);
    if (r) return { reminderId: Number(r.id), title: r.title, alreadyExisted: true };
  }

  const endISO = new Date(rec.endTime || Date.now()).toISOString();
  const { reminderId, title } = await createMeetingReminder({
    ownerUserId: userId,
    transcript,
    meetingTitle: ev?.title || 'Reunión de Meet',
    meetingEndISO: endISO,
    // Se guarda SIEMPRE el recordName: es la clave con la que este pase evita duplicar.
    sourceEventId: recordName,
    attachmentName: `transcripcion-reunion-${rec.meetingCode || 'meet'}.txt`,
    calendarEvent: ev ? { id: ev.id, description: ev.description, meeting_event_id: ev.meeting_event_id } : null,
    orphanRecord: { recordName, meetingCode: rec.meetingCode, endTime: rec.endTime },
    notifyMessage: ev ? `Generado de "${ev.title}"` : 'Generado a mano de una reunión de Meet',
  });

  return { reminderId, title, alreadyExisted: false };
}
