import { pool } from '@/lib/db';
import { CATEGORIES_SET, TZ } from '@/lib/centralized/pensamientos';

// Las constantes puras (categorías, zona horaria, bandas de intensidad) viven en
// `pensamientos.ts` para que los componentes de cliente puedan importarlas sin arrastrar
// el pool de Postgres a su bundle. Se re-exportan aquí por comodidad del lado servidor.
export { CATEGORIES, CATEGORIES_SET, TZ, INTENSITY_BANDS, intensityOf, type IntensityKey } from '@/lib/centralized/pensamientos';

/**
 * Módulo "Pensamientos": cuaderno personal de captura rápida. Un pensamiento puede ser un
 * texto corto o una lectura muy amplia; no tiene título (la captura debe ser inmediata).
 *
 * PRIVACIDAD: hoy un pensamiento solo lo lee su AUTOR — la autorización es por fila
 * (subject propio), no por rol. A futuro, un sistema del Centralizado ("Gestión Social ·
 * Recursos") podrá leer los pensamientos de todos por políticas internas de la organización;
 * por eso el modelo ya guarda `subject_kind`/`subject_id` en vez de atarlo al usuario logueado.
 *
 * CATEGORÍA: la asigna una IA (OpenAI) cada noche a la 01:00 (America/Guayaquil) a los
 * pensamientos que aún no la tienen. Las 4 categorías son EXACTAMENTE las `DIMENSIONS` del
 * sistema de Apoyo (laboral · corporal · mental · social) — fuente única, mismos colores.
 *
 * INTENSIDAD: se deriva de `char_count` (cantidad de texto escrito). Se denormaliza en la
 * fila para no recalcular `length()` sobre textos largos en cada consulta de los gráficos.
 */

/** Día local del pensamiento (no el día UTC): agrupa como lo percibe quien escribe. */
const LOCAL_DAY = `((t.created_at AT TIME ZONE '${TZ}')::date)`;

/* ── DDL ─────────────────────────────────────────────────────────────────────
 * Promise-singleton (patrón obligatorio de la casa): la UI dispara varios fetch en
 * paralelo y todos llaman a `ensure`; sin serializar, el DDL choca en Postgres.
 */
let ready = false;
let ensuring: Promise<void> | null = null;

export async function ensurePensamientosTables(): Promise<void> {
  if (ready) return;
  if (ensuring) return ensuring;
  ensuring = doEnsure().then(() => { ready = true; }).finally(() => { ensuring = null; });
  return ensuring;
}

async function doEnsure(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.pn_thoughts (
      id BIGSERIAL PRIMARY KEY,
      subject_kind TEXT NOT NULL,                 -- 'member' | 'candidate'
      subject_id TEXT NOT NULL,                   -- members.id | clients.id (como texto)
      content TEXT NOT NULL,
      char_count INT NOT NULL DEFAULT 0,          -- intensidad (denormalizado)
      category TEXT,                              -- laboral|corporal|mental|social (NULL = sin etiquetar)
      categorized_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS pn_thoughts_subject_idx ON gcc_world.pn_thoughts (subject_kind, subject_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS pn_thoughts_created_idx ON gcc_world.pn_thoughts (created_at)`);
  // Índice PARCIAL: el trabajo nocturno solo busca los que están sin etiquetar.
  await pool.query(`CREATE INDEX IF NOT EXISTS pn_thoughts_pending_idx ON gcc_world.pn_thoughts (id) WHERE category IS NULL`);

  // Bitácora del trabajo nocturno (observabilidad: saber si corrió y qué hizo).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.pn_tagging_runs (
      id BIGSERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      tagged INT NOT NULL DEFAULT 0,
      failed INT NOT NULL DEFAULT 0,
      trigger TEXT NOT NULL DEFAULT 'cron',       -- 'cron' | 'manual'
      error TEXT
    )`);
}

/* ── Tipos ───────────────────────────────────────────────────────────────────── */

export interface Thought {
  id: number;
  content: string;
  charCount: number;
  category: string | null;
  day: string;              // YYYY-MM-DD (día LOCAL)
  createdAt: string;
  updatedAt: string;
}

export interface DayBucket {
  day: string;              // YYYY-MM-DD
  count: number;
  chars: number;
}

export interface Subject { kind: string; id: string }

const mapThought = (r: any): Thought => ({
  id: Number(r.id),
  content: r.content,
  charCount: Number(r.char_count || 0),
  category: r.category ?? null,
  day: r.day,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

/* ── Lectura (siempre acotada al sujeto: privacidad por fila) ────────────────── */

/** Días en los que el sujeto escribió, con su conteo y su total de caracteres. */
export async function listDays(s: Subject): Promise<DayBucket[]> {
  await ensurePensamientosTables();
  const { rows } = await pool.query(
    `SELECT to_char(${LOCAL_DAY}, 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS count,
            COALESCE(SUM(t.char_count), 0)::int AS chars
       FROM gcc_world.pn_thoughts t
      WHERE t.subject_kind = $1 AND t.subject_id = $2
      GROUP BY ${LOCAL_DAY}
      ORDER BY ${LOCAL_DAY} DESC`,
    [s.kind, s.id],
  );
  return rows.map((r: any) => ({ day: r.day, count: Number(r.count), chars: Number(r.chars) }));
}

/** Pensamientos de un día concreto (o los más recientes si no se indica día). */
export async function listThoughts(s: Subject, day?: string, limit = 200): Promise<Thought[]> {
  await ensurePensamientosTables();
  const dayed = !!day && /^\d{4}-\d{2}-\d{2}$/.test(day);
  const params: any[] = [s.kind, s.id];
  let clause = '';
  if (dayed) { params.push(day); clause = `AND ${LOCAL_DAY} = $3::date`; }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT t.id, t.content, t.char_count, t.category, t.created_at, t.updated_at,
            to_char(${LOCAL_DAY}, 'YYYY-MM-DD') AS day
       FROM gcc_world.pn_thoughts t
      WHERE t.subject_kind = $1 AND t.subject_id = $2 ${clause}
      ORDER BY t.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapThought);
}

/* ── Lectura por la ORGANIZACIÓN (Gestión Social · Recursos) ──────────────────
 * Estas dos funciones leen los pensamientos de OTRA persona. Son la excepción a la
 * privacidad por fila y solo deben llamarse desde rutas que ya hayan comprobado el acceso
 * al sistema `gestion-social` (ver `lib/centralized/system-access.ts`).
 */

/** Pensamientos de un sujeto, opcionalmente filtrados por categoría. */
export async function listThoughtsOfSubject(s: Subject, categoria?: string, limit = 300): Promise<Thought[]> {
  await ensurePensamientosTables();
  const params: any[] = [s.kind, s.id];
  let clause = '';
  if (categoria && CATEGORIES_SET.has(categoria)) { params.push(categoria); clause = `AND t.category = $3`; }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT t.id, t.content, t.char_count, t.category, t.created_at, t.updated_at,
            to_char(${LOCAL_DAY}, 'YYYY-MM-DD') AS day
       FROM gcc_world.pn_thoughts t
      WHERE t.subject_kind = $1 AND t.subject_id = $2 ${clause}
      ORDER BY t.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  return rows.map(mapThought);
}

/** Conteo de pensamientos por categoría de un sujeto (para el rail de tipos). */
export async function countByCategory(s: Subject): Promise<Record<string, number>> {
  await ensurePensamientosTables();
  const { rows } = await pool.query(
    `SELECT COALESCE(category, '_sin') AS k, COUNT(*)::int AS n
       FROM gcc_world.pn_thoughts
      WHERE subject_kind = $1 AND subject_id = $2
      GROUP BY 1`,
    [s.kind, s.id],
  );
  const out: Record<string, number> = { _todas: 0 };
  for (const r of rows) { out[r.k] = Number(r.n); out._todas += Number(r.n); }
  return out;
}

/* ── Escritura ───────────────────────────────────────────────────────────────── */

export async function createThought(s: Subject, content: string): Promise<Thought> {
  await ensurePensamientosTables();
  const text = content.trim();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.pn_thoughts (subject_kind, subject_id, content, char_count)
     VALUES ($1, $2, $3, $4)
     RETURNING id, content, char_count, category, created_at, updated_at,
               to_char((created_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day`,
    [s.kind, s.id, text, text.length],
  );
  return mapThought(rows[0]);
}

/**
 * Edita un pensamiento propio. Al cambiar el texto se **borra la categoría** para que la IA
 * lo vuelva a etiquetar esa noche: si el contenido cambió, la etiqueta anterior ya no es
 * necesariamente válida.
 */
export async function updateThought(s: Subject, id: number, content: string): Promise<void> {
  await ensurePensamientosTables();
  const text = content.trim();
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.pn_thoughts
        SET content = $4, char_count = $5, category = NULL, categorized_at = NULL, updated_at = NOW()
      WHERE id = $3 AND subject_kind = $1 AND subject_id = $2`,
    [s.kind, s.id, id, text, text.length],
  );
  if (rowCount === 0) throw new Error('No se encontró el pensamiento.');
}

export async function deleteThought(s: Subject, id: number): Promise<void> {
  await ensurePensamientosTables();
  const { rowCount } = await pool.query(
    `DELETE FROM gcc_world.pn_thoughts WHERE id = $3 AND subject_kind = $1 AND subject_id = $2`,
    [s.kind, s.id, id],
  );
  if (rowCount === 0) throw new Error('No se encontró el pensamiento.');
}

/* ── Estadísticas para los gráficos ──────────────────────────────────────────── */

export interface MonthCategoryBucket {
  month: string;                          // YYYY-MM
  byCategory: Record<string, number>;     // conteo por categoría
  chars: number;                          // intensidad del mes (total de caracteres)
  count: number;                          // total de pensamientos del mes
}

export interface Stats {
  days: DayBucket[];
  months: MonthCategoryBucket[];
  totals: { count: number; chars: number; uncategorized: number };
}

/**
 * Series para los gráficos: por día (cantidad + intensidad) y por mes desglosado por
 * categoría (+ intensidad mensual). Todo del sujeto y en su día/mes LOCAL.
 */
export async function getStats(s: Subject): Promise<Stats> {
  await ensurePensamientosTables();
  const days = await listDays(s);

  const { rows: monthRows } = await pool.query(
    `SELECT to_char(date_trunc('month', (t.created_at AT TIME ZONE '${TZ}')), 'YYYY-MM') AS month,
            t.category,
            COUNT(*)::int AS count,
            COALESCE(SUM(t.char_count), 0)::int AS chars
       FROM gcc_world.pn_thoughts t
      WHERE t.subject_kind = $1 AND t.subject_id = $2
      GROUP BY 1, 2
      ORDER BY 1 ASC`,
    [s.kind, s.id],
  );
  const byMonth = new Map<string, MonthCategoryBucket>();
  for (const r of monthRows) {
    const m: MonthCategoryBucket = byMonth.get(r.month) || { month: r.month, byCategory: {}, chars: 0, count: 0 };
    if (r.category) m.byCategory[r.category] = (m.byCategory[r.category] || 0) + Number(r.count);
    m.chars += Number(r.chars);
    m.count += Number(r.count);
    byMonth.set(r.month, m);
  }

  const { rows: tot } = await pool.query(
    `SELECT COUNT(*)::int AS count,
            COALESCE(SUM(char_count), 0)::int AS chars,
            COUNT(*) FILTER (WHERE category IS NULL)::int AS uncategorized
       FROM gcc_world.pn_thoughts WHERE subject_kind = $1 AND subject_id = $2`,
    [s.kind, s.id],
  );

  return {
    days,
    months: Array.from(byMonth.values()),
    totals: { count: Number(tot[0].count), chars: Number(tot[0].chars), uncategorized: Number(tot[0].uncategorized) },
  };
}

/* ── Trabajo nocturno de etiquetado ──────────────────────────────────────────── */

export interface PendingThought { id: number; content: string }

/**
 * Pensamientos SIN etiquetar, de TODOS los usuarios (el trabajo nocturno es global).
 * `limit` acota el lote para no disparar el coste ni el tiempo de una sola ejecución.
 */
export async function listUncategorized(limit = 200): Promise<PendingThought[]> {
  await ensurePensamientosTables();
  const { rows } = await pool.query(
    `SELECT id, content FROM gcc_world.pn_thoughts
      WHERE category IS NULL ORDER BY created_at ASC LIMIT $1`,
    [limit],
  );
  return rows.map((r: any) => ({ id: Number(r.id), content: r.content }));
}

/** Fija la categoría de un pensamiento (solo si sigue sin etiquetar: no pisa ediciones). */
export async function setCategory(id: number, category: string): Promise<boolean> {
  if (!CATEGORIES_SET.has(category)) return false;
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.pn_thoughts SET category = $2, categorized_at = NOW()
      WHERE id = $1 AND category IS NULL`,
    [id, category],
  );
  return (rowCount || 0) > 0;
}

export async function startRun(trigger: 'cron' | 'manual'): Promise<number> {
  await ensurePensamientosTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.pn_tagging_runs (trigger) VALUES ($1) RETURNING id`, [trigger]);
  return Number(rows[0].id);
}

export async function finishRun(runId: number, tagged: number, failed: number, error?: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.pn_tagging_runs SET finished_at = NOW(), tagged = $2, failed = $3, error = $4 WHERE id = $1`,
    [runId, tagged, failed, error ?? null],
  );
}

/** Última ejecución del trabajo nocturno (para mostrarla en la UI). */
export async function lastRun(): Promise<{ startedAt: string; finishedAt: string | null; tagged: number; failed: number; trigger: string; error: string | null } | null> {
  await ensurePensamientosTables();
  const { rows } = await pool.query(
    `SELECT started_at, finished_at, tagged, failed, trigger, error
       FROM gcc_world.pn_tagging_runs ORDER BY id DESC LIMIT 1`);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    startedAt: new Date(r.started_at).toISOString(),
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    tagged: Number(r.tagged), failed: Number(r.failed), trigger: r.trigger, error: r.error ?? null,
  };
}
