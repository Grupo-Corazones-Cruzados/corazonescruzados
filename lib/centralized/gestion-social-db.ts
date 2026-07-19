import { pool } from '@/lib/db';
import { VALORES_SET } from '@/lib/centralized/valores';
import { TALENTOS_SET } from '@/lib/centralized/talentos';

/**
 * Sistema "Gestión Social" (Centralizado · controlador · gestión, celda "Soluciones").
 *
 * Funcionalidad EVENTOS: el usuario del sistema crea eventos; cada evento contiene un
 * conjunto de TAREAS con etiquetas de valores/talentos (mismas listas canónicas que el
 * Horario de Vida) y una propiedad `plazas` = cuántas personas pueden tomarla.
 *
 * Los miembros/candidatos ven los eventos publicados desde el módulo "Experiencias",
 * toman UNA tarea del evento (si quedan plazas) y esa tarea aterriza en su "Mi día" como
 * entrada FIJA — bloqueada hasta que el usuario del sistema marque el INICIO del evento.
 * Al marcar el FIN, las tomas que sigan `pending` pasan automáticamente a `failed`.
 *
 * Puntuación: `gs_task_signups` es la TERCERA fuente de `getSubjectsProfileScores`
 * (`horario-db.ts`), con el mismo formato (subject, status, value_tags, talent_tags):
 * completada = +1 a cada etiqueta, fallida = −1, pendiente no puntúa.
 *
 * Reglas de negocio (decididas con el usuario 2026-07-19):
 *  - Una persona toma como MÁXIMO 1 tarea por evento (de ahí el UNIQUE por event_id).
 *  - Solo puede soltarla mientras el evento siga `published` (una vez `active`, se compromete).
 *  - El bloque en Mi día usa el horario del EVENTO, salvo que la tarea defina el suyo propio.
 */

export type EventStatus = 'draft' | 'published' | 'active' | 'finished' | 'cancelled';
export type SignupStatus = 'pending' | 'completed' | 'failed';

export const EVENT_STATUSES: EventStatus[] = ['draft', 'published', 'active', 'finished', 'cancelled'];
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Borrador', published: 'Publicado', active: 'En curso', finished: 'Finalizado', cancelled: 'Cancelado',
};

/* ── DDL ─────────────────────────────────────────────────────────────────────
 * Promise-singleton OBLIGATORIO: la UI dispara varios fetch en paralelo y todos
 * llaman a `ensure`; sin serializar, el DDL nuevo choca en Postgres en la primera
 * carga (mismo patrón que percepcion-db.ts / gestion-datos-db.ts).
 */
let ready = false;
let ensuring: Promise<void> | null = null;

export async function ensureGestionSocialTables(): Promise<void> {
  if (ready) return;
  if (ensuring) return ensuring;
  ensuring = doEnsure().then(() => { ready = true; }).finally(() => { ensuring = null; });
  return ensuring;
}

async function doEnsure(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gs_events (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      event_date DATE NOT NULL,
      start_time TEXT,                              -- 'HH:MM' (null = todo el día)
      end_time TEXT,
      all_day BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'draft',         -- draft|published|active|finished|cancelled
      started_at TIMESTAMPTZ,                       -- lo fija el INICIO manual
      ended_at TIMESTAMPTZ,                         -- lo fija el FIN manual
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gs_events_status_idx ON gcc_world.gs_events (status)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gs_event_tasks (
      id BIGSERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL REFERENCES gcc_world.gs_events(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      value_tags TEXT[] NOT NULL DEFAULT '{}',      -- keys de VALORES
      talent_tags TEXT[] NOT NULL DEFAULT '{}',     -- strings literales de TALENTOS
      plazas INT NOT NULL DEFAULT 1,
      start_time TEXT,                              -- null = hereda el horario del evento
      end_time TEXT,
      position INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gs_event_tasks_event_idx ON gcc_world.gs_event_tasks (event_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gs_task_signups (
      id BIGSERIAL PRIMARY KEY,
      task_id BIGINT NOT NULL REFERENCES gcc_world.gs_event_tasks(id) ON DELETE CASCADE,
      event_id BIGINT NOT NULL REFERENCES gcc_world.gs_events(id) ON DELETE CASCADE,
      subject_kind TEXT NOT NULL,                   -- 'member' | 'candidate'
      subject_id TEXT NOT NULL,                     -- members.id | clients.id (como texto)
      status TEXT NOT NULL DEFAULT 'pending',       -- pending|completed|failed
      signed_up_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (task_id, subject_kind, subject_id),
      -- Regla del usuario: UNA sola tarea por persona y evento.
      UNIQUE (event_id, subject_kind, subject_id)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gs_signups_subject_idx ON gcc_world.gs_task_signups (subject_kind, subject_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gs_signups_task_idx ON gcc_world.gs_task_signups (task_id)`);
}

/**
 * Filtra las etiquetas contra las listas CANÓNICAS (`VALORES` / `TALENTOS`), igual que
 * hace el Horario de Vida en `PATCH /api/centralized/horario`. Definición única: la usan
 * las rutas de crear y editar tarea. Los valores viajan por `key`; los talentos, por su
 * string literal.
 */
export function sanitizeTags(b: any): { values: string[]; talents: string[] } {
  return {
    values: Array.isArray(b?.values) ? b.values.map(String).filter((v: string) => VALORES_SET.has(v)) : [],
    talents: Array.isArray(b?.talents) ? b.talents.map(String).filter((t: string) => TALENTOS_SET.has(t)) : [],
  };
}

/* ── Tipos expuestos ─────────────────────────────────────────────────────────── */

export interface EventTask {
  id: number;
  eventId: number;
  title: string;
  detail: string;
  values: string[];
  talents: string[];
  plazas: number;
  taken: number;
  free: number;
  startTime: string | null;
  endTime: string | null;
  position: number;
  /** Quiénes la tomaron (solo se rellena en el detalle del sistema). */
  signups?: { id: number; subjectKind: string; subjectId: string; name: string; status: SignupStatus }[];
  /** Toma del sujeto consultado (solo en la vista de Experiencias). */
  mine?: { id: number; status: SignupStatus } | null;
}

export interface SocialEvent {
  id: number;
  name: string;
  description: string;
  location: string;
  eventDate: string;          // YYYY-MM-DD
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  status: EventStatus;
  startedAt: string | null;
  endedAt: string | null;
  taskCount: number;
  plazasTotal: number;
  plazasTaken: number;
  tasks?: EventTask[];
  /** Tarea que el sujeto consultado ya tomó en este evento (Experiencias). */
  myTaskId?: number | null;
}

const mapEvent = (r: any): SocialEvent => ({
  id: Number(r.id),
  name: r.name,
  description: r.description || '',
  location: r.location || '',
  eventDate: r.event_date,
  startTime: r.start_time ?? null,
  endTime: r.end_time ?? null,
  allDay: !!r.all_day,
  status: (r.status as EventStatus) || 'draft',
  startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
  endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
  taskCount: Number(r.task_count || 0),
  plazasTotal: Number(r.plazas_total || 0),
  plazasTaken: Number(r.plazas_taken || 0),
});

/** SELECT base con los agregados de tareas/plazas (LATERAL para no multiplicar filas). */
const EVENT_SELECT = `
  SELECT e.*, agg.task_count, agg.plazas_total, agg.plazas_taken
    FROM gcc_world.gs_events e
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS task_count,
             COALESCE(SUM(t.plazas), 0)::int AS plazas_total,
             COALESCE(SUM((SELECT COUNT(*) FROM gcc_world.gs_task_signups s WHERE s.task_id = t.id)), 0)::int AS plazas_taken
        FROM gcc_world.gs_event_tasks t WHERE t.event_id = e.id
    ) agg ON TRUE`;

/* ── Eventos (lado del sistema) ──────────────────────────────────────────────── */

/** Lista de eventos + conteos por estado (para el rail de filtro). */
export async function listEvents(status?: string): Promise<{ events: SocialEvent[]; counts: Record<string, number> }> {
  await ensureGestionSocialTables();
  const filtered = status && EVENT_STATUSES.includes(status as EventStatus);
  const { rows } = await pool.query(
    `${EVENT_SELECT} ${filtered ? 'WHERE e.status = $1' : ''} ORDER BY e.event_date DESC, e.id DESC`,
    filtered ? [status] : [],
  );
  const { rows: cnt } = await pool.query(
    `SELECT status, COUNT(*)::int AS n FROM gcc_world.gs_events GROUP BY status`,
  );
  const counts: Record<string, number> = { all: 0 };
  for (const c of cnt) { counts[c.status] = Number(c.n); counts.all += Number(c.n); }
  for (const s of EVENT_STATUSES) counts[s] = counts[s] || 0;
  return { events: rows.map(mapEvent), counts };
}

/**
 * Detalle de un evento con sus tareas. Si `subject` viene, además resuelve la toma
 * propia del sujeto (vista de Experiencias) en vez del listado de inscritos.
 */
export async function getEvent(
  id: number,
  subject?: { kind: string; id: string } | null,
): Promise<SocialEvent | null> {
  await ensureGestionSocialTables();
  const { rows } = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [id]);
  if (rows.length === 0) return null;
  const event = mapEvent(rows[0]);

  const { rows: taskRows } = await pool.query(
    `SELECT t.*, (SELECT COUNT(*)::int FROM gcc_world.gs_task_signups s WHERE s.task_id = t.id) AS taken
       FROM gcc_world.gs_event_tasks t WHERE t.event_id = $1 ORDER BY t.position, t.id`,
    [id],
  );

  // Inscritos, con el nombre resuelto según el tipo de sujeto (miembro o candidato).
  const { rows: signRows } = await pool.query(
    `SELECT s.id, s.task_id, s.subject_kind, s.subject_id, s.status,
            COALESCE(m.name, c.full_name, c.name, s.subject_id) AS name
       FROM gcc_world.gs_task_signups s
       LEFT JOIN gcc_world.members m ON s.subject_kind = 'member'    AND m.id::text = s.subject_id
       LEFT JOIN gcc_world.clients c ON s.subject_kind = 'candidate' AND c.id::text = s.subject_id
      WHERE s.event_id = $1`,
    [id],
  );
  const signupsBy = new Map<number, EventTask['signups']>();
  for (const s of signRows) {
    const arr = signupsBy.get(Number(s.task_id)) || [];
    arr.push({ id: Number(s.id), subjectKind: s.subject_kind, subjectId: s.subject_id, name: s.name, status: s.status });
    signupsBy.set(Number(s.task_id), arr);
  }

  event.myTaskId = null;
  event.tasks = taskRows.map((t: any) => {
    const plazas = Number(t.plazas || 0);
    const taken = Number(t.taken || 0);
    const signups = signupsBy.get(Number(t.id)) || [];
    const mineRow = subject ? signups.find((s) => s.subjectKind === subject.kind && s.subjectId === subject.id) : undefined;
    if (mineRow) event.myTaskId = Number(t.id);
    return {
      id: Number(t.id),
      eventId: Number(t.event_id),
      title: t.title,
      detail: t.detail || '',
      values: t.value_tags || [],
      talents: t.talent_tags || [],
      plazas,
      taken,
      free: Math.max(0, plazas - taken),
      startTime: t.start_time ?? null,
      endTime: t.end_time ?? null,
      position: Number(t.position || 0),
      signups,
      mine: mineRow ? { id: mineRow.id, status: mineRow.status } : null,
    };
  });
  return event;
}

export async function createEvent(input: {
  name: string; description?: string; location?: string; eventDate: string;
  startTime?: string | null; endTime?: string | null; allDay?: boolean; createdBy?: string | null;
}): Promise<{ id: number }> {
  await ensureGestionSocialTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gs_events (name, description, location, event_date, start_time, end_time, all_day, created_by)
     VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8) RETURNING id`,
    [
      input.name.trim(), input.description?.trim() || '', input.location?.trim() || '', input.eventDate,
      input.allDay ? null : (input.startTime || null), input.allDay ? null : (input.endTime || null),
      !!input.allDay, input.createdBy ?? null,
    ],
  );
  return { id: Number(rows[0].id) };
}

export async function updateEvent(id: number, input: {
  name?: string; description?: string; location?: string; eventDate?: string;
  startTime?: string | null; endTime?: string | null; allDay?: boolean; status?: EventStatus;
}): Promise<void> {
  await ensureGestionSocialTables();
  const sets: string[] = [];
  const params: any[] = [];
  const put = (col: string, val: any, cast = '') => { params.push(val); sets.push(`${col} = $${params.length}${cast}`); };
  if (input.name !== undefined) put('name', input.name.trim());
  if (input.description !== undefined) put('description', input.description.trim());
  if (input.location !== undefined) put('location', input.location.trim());
  if (input.eventDate !== undefined) put('event_date', input.eventDate, '::date');
  if (input.allDay !== undefined) put('all_day', !!input.allDay);
  if (input.startTime !== undefined) put('start_time', input.allDay ? null : (input.startTime || null));
  if (input.endTime !== undefined) put('end_time', input.allDay ? null : (input.endTime || null));
  if (input.status !== undefined) put('status', input.status);
  if (sets.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.gs_events SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
}

export async function deleteEvent(id: number): Promise<void> {
  await ensureGestionSocialTables();
  await pool.query(`DELETE FROM gcc_world.gs_events WHERE id = $1`, [id]);
}

/**
 * INICIO manual del evento. Solo desde `published` (un borrador debe publicarse antes,
 * para que alguien haya podido tomar tareas). Desbloquea el marcado de estado en Mi día.
 */
export async function startEvent(id: number): Promise<void> {
  await ensureGestionSocialTables();
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.gs_events SET status = 'active', started_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'published'`,
    [id],
  );
  if (rowCount === 0) throw new Error('Solo se puede iniciar un evento publicado.');
}

/**
 * FIN manual del evento. Conserva las tomas ya marcadas `completed`/`failed` y marca
 * automáticamente como `failed` las que sigan `pending` (el usuario no la completó
 * durante el evento). Ambas cosas en UNA transacción para no dejar estados a medias.
 */
export async function finishEvent(id: number): Promise<{ autoFailed: number }> {
  await ensureGestionSocialTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE gcc_world.gs_events SET status = 'finished', ended_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status = 'active'`,
      [id],
    );
    if (rowCount === 0) throw new Error('Solo se puede finalizar un evento en curso.');
    const res = await client.query(
      `UPDATE gcc_world.gs_task_signups SET status = 'failed' WHERE event_id = $1 AND status = 'pending'`,
      [id],
    );
    await client.query('COMMIT');
    return { autoFailed: res.rowCount || 0 };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ── Tareas del evento ───────────────────────────────────────────────────────── */

export async function createTask(eventId: number, input: {
  title: string; detail?: string; values?: string[]; talents?: string[];
  plazas?: number; startTime?: string | null; endTime?: string | null;
}): Promise<{ id: number }> {
  await ensureGestionSocialTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gs_event_tasks (event_id, title, detail, value_tags, talent_tags, plazas, start_time, end_time, position)
     VALUES ($1, $2, $3, $4::text[], $5::text[], $6, $7, $8,
             COALESCE((SELECT MAX(position) + 1 FROM gcc_world.gs_event_tasks WHERE event_id = $1), 0))
     RETURNING id`,
    [
      eventId, input.title.trim(), input.detail?.trim() || '',
      input.values || [], input.talents || [],
      Math.max(1, Number(input.plazas) || 1),
      input.startTime || null, input.endTime || null,
    ],
  );
  return { id: Number(rows[0].id) };
}

export async function updateTask(id: number, input: {
  title?: string; detail?: string; values?: string[]; talents?: string[];
  plazas?: number; startTime?: string | null; endTime?: string | null;
}): Promise<void> {
  await ensureGestionSocialTables();
  const sets: string[] = [];
  const params: any[] = [];
  const put = (col: string, val: any, cast = '') => { params.push(val); sets.push(`${col} = $${params.length}${cast}`); };
  if (input.title !== undefined) put('title', input.title.trim());
  if (input.detail !== undefined) put('detail', input.detail.trim());
  if (input.values !== undefined) put('value_tags', input.values, '::text[]');
  if (input.talents !== undefined) put('talent_tags', input.talents, '::text[]');
  if (input.plazas !== undefined) put('plazas', Math.max(1, Number(input.plazas) || 1));
  if (input.startTime !== undefined) put('start_time', input.startTime || null);
  if (input.endTime !== undefined) put('end_time', input.endTime || null);
  if (sets.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.gs_event_tasks SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}

export async function deleteTask(id: number): Promise<void> {
  await ensureGestionSocialTables();
  await pool.query(`DELETE FROM gcc_world.gs_event_tasks WHERE id = $1`, [id]);
}

/* ── Toma de tareas (lado del miembro · módulo Experiencias) ─────────────────── */

/**
 * TOMA una tarea del evento. Transaccional con `FOR UPDATE` sobre la fila de la tarea:
 * sin ese bloqueo, dos personas que pulsan a la vez podrían pasar ambas el chequeo de
 * plazas y sobre-asignar la última (condición de carrera clásica de "cupos").
 * Valida: evento publicado · quedan plazas · la persona no tiene ya otra tarea del evento.
 */
export async function takeTask(taskId: number, subjectKind: string, subjectId: string): Promise<{ id: number }> {
  await ensureGestionSocialTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bloquea la tarea para serializar las tomas concurrentes de ESTA tarea.
    const { rows: tRows } = await client.query(
      `SELECT t.id, t.event_id, t.plazas, e.status
         FROM gcc_world.gs_event_tasks t
         JOIN gcc_world.gs_events e ON e.id = t.event_id
        WHERE t.id = $1 FOR UPDATE OF t`,
      [taskId],
    );
    if (tRows.length === 0) throw new Error('La tarea no existe.');
    const task = tRows[0];
    if (task.status !== 'published') throw new Error('El evento no está abierto para tomar tareas.');

    const { rows: cRows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM gcc_world.gs_task_signups WHERE task_id = $1`,
      [taskId],
    );
    if (Number(cRows[0].n) >= Number(task.plazas)) throw new Error('Ya no quedan plazas en esta tarea.');

    const { rows: mine } = await client.query(
      `SELECT id FROM gcc_world.gs_task_signups WHERE event_id = $1 AND subject_kind = $2 AND subject_id = $3`,
      [task.event_id, subjectKind, subjectId],
    );
    if (mine.length > 0) throw new Error('Ya tomaste una tarea en este evento.');

    const { rows } = await client.query(
      `INSERT INTO gcc_world.gs_task_signups (task_id, event_id, subject_kind, subject_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [taskId, task.event_id, subjectKind, subjectId],
    );
    await client.query('COMMIT');
    return { id: Number(rows[0].id) };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** SUELTA la tarea y libera la plaza. Solo mientras el evento siga `published`. */
export async function releaseTask(taskId: number, subjectKind: string, subjectId: string): Promise<void> {
  await ensureGestionSocialTables();
  const { rowCount } = await pool.query(
    `DELETE FROM gcc_world.gs_task_signups s
      USING gcc_world.gs_events e
      WHERE s.event_id = e.id AND s.task_id = $1 AND s.subject_kind = $2 AND s.subject_id = $3
        AND e.status = 'published'`,
    [taskId, subjectKind, subjectId],
  );
  if (rowCount === 0) throw new Error('No puedes soltar esta tarea (el evento ya inició o no la tienes tomada).');
}

/* ── Vista del módulo "Experiencias" ─────────────────────────────────────────── */

/**
 * Eventos visibles para un miembro/candidato: los publicados o en curso, más aquellos
 * ya finalizados en los que participó (para que conserve el historial de su experiencia).
 */
export async function listEventsForSubject(subjectKind: string, subjectId: string): Promise<SocialEvent[]> {
  await ensureGestionSocialTables();
  const { rows } = await pool.query(
    `${EVENT_SELECT}
      WHERE e.status IN ('published', 'active')
         OR EXISTS (SELECT 1 FROM gcc_world.gs_task_signups s
                     WHERE s.event_id = e.id AND s.subject_kind = $1 AND s.subject_id = $2)
      ORDER BY e.event_date ASC, e.id ASC`,
    [subjectKind, subjectId],
  );
  const events: SocialEvent[] = rows.map(mapEvent);
  if (events.length === 0) return events;
  const { rows: mine } = await pool.query(
    `SELECT event_id, task_id FROM gcc_world.gs_task_signups
      WHERE subject_kind = $1 AND subject_id = $2 AND event_id = ANY($3::bigint[])`,
    [subjectKind, subjectId, events.map((e) => e.id)],
  );
  const byEvent = new Map<number, number>(mine.map((m: any) => [Number(m.event_id), Number(m.task_id)]));
  for (const e of events) e.myTaskId = byEvent.get(e.id) ?? null;
  return events;
}

/* ── Integración con el Horario / "Mi día" ───────────────────────────────────── */

/**
 * Tarea de Gestión Social tomada por el sujeto, vista como entrada del horario. Es FIJA
 * (no se mueve ni se quita) y queda BLOQUEADA (`locked`) mientras el evento no esté
 * `active`: solo se puede marcar su estado con el evento en curso.
 */
export interface SocialTask {
  id: number;              // id de la fila de gs_task_signups → cambiar estado
  taskId: number;
  eventId: number;
  eventName: string;
  eventStatus: EventStatus;
  day: string;             // YYYY-MM-DD (fecha del evento)
  title: string;
  detail: string;
  values: string[];
  talents: string[];
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  status: SignupStatus;
  /** true = el evento aún no inició (o ya terminó) → no se puede cambiar el estado. */
  locked: boolean;
}

/**
 * Tareas de Gestión Social del sujeto, acotadas a [from, to) si se indica. El horario
 * sale del EVENTO salvo que la tarea defina el suyo propio (decisión del usuario).
 */
export async function getSubjectSocialTasks(subjectKind: string, subjectId: string, from?: string, to?: string): Promise<SocialTask[]> {
  await ensureGestionSocialTables();
  const windowed = !!(from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to));
  const params: any[] = [subjectKind, subjectId];
  let windowClause = '';
  if (windowed) { params.push(from, to); windowClause = `AND e.event_date >= $3::date AND e.event_date < $4::date`; }
  const { rows } = await pool.query(
    `SELECT s.id, s.status, s.task_id, e.id AS event_id, e.name AS event_name, e.status AS event_status,
            to_char(e.event_date, 'YYYY-MM-DD') AS day, e.all_day AS event_all_day,
            t.title, t.detail, t.value_tags, t.talent_tags,
            COALESCE(t.start_time, e.start_time) AS start_time,
            COALESCE(t.end_time, e.end_time) AS end_time
       FROM gcc_world.gs_task_signups s
       JOIN gcc_world.gs_event_tasks t ON t.id = s.task_id
       JOIN gcc_world.gs_events e ON e.id = s.event_id
      WHERE s.subject_kind = $1 AND s.subject_id = $2 AND e.status <> 'cancelled' ${windowClause}
      ORDER BY e.event_date, s.id`,
    params,
  );
  return rows.map((r: any) => {
    const startTime = r.start_time ?? null;
    return {
      id: Number(r.id),
      taskId: Number(r.task_id),
      eventId: Number(r.event_id),
      eventName: r.event_name,
      eventStatus: r.event_status as EventStatus,
      day: r.day,
      title: r.title,
      detail: r.detail || '',
      values: r.value_tags || [],
      talents: r.talent_tags || [],
      allDay: !!r.event_all_day && !startTime,
      startTime,
      endTime: r.end_time ?? null,
      status: (r.status as SignupStatus) || 'pending',
      locked: r.event_status !== 'active',
    };
  });
}

/**
 * Cambia el estado de una toma. Solo el DUEÑO de la fila y solo con el evento `active`
 * (el bloqueo es de negocio: no se puede marcar antes del inicio ni tras el fin — al
 * finalizar, `finishEvent` ya congeló los pendientes como fallidos).
 */
export async function setSocialTaskStatus(signupId: number, subjectKind: string, subjectId: string, status: SignupStatus): Promise<void> {
  await ensureGestionSocialTables();
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.gs_task_signups s SET status = $4
       FROM gcc_world.gs_events e
      WHERE s.event_id = e.id AND s.id = $1 AND s.subject_kind = $2 AND s.subject_id = $3
        AND e.status = 'active'`,
    [signupId, subjectKind, subjectId, status],
  );
  if (rowCount === 0) throw new Error('No puedes cambiar el estado de esta tarea (el evento no está en curso).');
}
