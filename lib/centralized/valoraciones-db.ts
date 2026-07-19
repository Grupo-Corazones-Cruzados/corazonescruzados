import { pool } from '@/lib/db';
import { VALORES_SET } from '@/lib/centralized/valores';
import { TALENTOS_SET } from '@/lib/centralized/talentos';

/**
 * VALORACIÓN GLOBAL de un sujeto (candidato o miembro), asignada a mano desde
 * "Gestión Social · Recursos" tras leer sus pensamientos.
 *
 * ⚠️ SEMÁNTICA: la puntuación es **FIJA, NO ACUMULATIVA**. Si hoy se le ponen 5 puntos a un
 * talento y mañana 3, el perfil pasa a mostrar **3**, no 8. Por eso guardar **reemplaza el
 * conjunto entero** del sujeto dentro de una transacción, en lugar de ir sumando filas.
 *
 * ⚠️ Y NO se mezcla con el conteo ±1 de las tareas (`getSubjectsProfileScores`): son cosas
 * distintas —un porcentaje derivado de tareas cumplidas frente a puntos absolutos que asigna
 * una persona—, y sumarlas daría un número sin significado. Viajan juntas pero separadas
 * dentro de `CandidateCriteria.assessment`.
 */

export type ItemKind = 'talent' | 'value';

export interface AssessmentItem {
  kind: ItemKind;
  /** Talento = su string literal; valor = su `key`. Igual que las etiquetas de tareas. */
  itemKey: string;
  points: number;
}

export interface Assessment {
  talents: { itemKey: string; points: number }[];
  values: { itemKey: string; points: number }[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Rango admitido por punto. Acota errores de dedo sin encorsetar el criterio del evaluador. */
export const MIN_POINTS = -100;
export const MAX_POINTS = 100;

/* ── DDL (promise-singleton) ─────────────────────────────────────────────────── */
let ready = false;
let ensuring: Promise<void> | null = null;

export async function ensureValoracionesTables(): Promise<void> {
  if (ready) return;
  if (ensuring) return ensuring;
  ensuring = doEnsure().then(() => { ready = true; }).finally(() => { ensuring = null; });
  return ensuring;
}

async function doEnsure(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gs_valoraciones (
      id BIGSERIAL PRIMARY KEY,
      subject_kind TEXT NOT NULL,                 -- 'member' | 'candidate'
      subject_id TEXT NOT NULL,                   -- members.id | clients.id (como texto)
      kind TEXT NOT NULL,                         -- 'talent' | 'value'
      item_key TEXT NOT NULL,                     -- talento (string) | valor (key)
      points INT NOT NULL DEFAULT 0,
      updated_by TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      -- Una sola fila por (sujeto, tipo, ítem): garantiza que la puntuación REEMPLACE.
      UNIQUE (subject_kind, subject_id, kind, item_key)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gs_valoraciones_subject_idx ON gcc_world.gs_valoraciones (subject_kind, subject_id)`);
}

/* ── Lectura ─────────────────────────────────────────────────────────────────── */

export async function getAssessment(subjectKind: string, subjectId: string): Promise<Assessment> {
  await ensureValoracionesTables();
  const { rows } = await pool.query(
    `SELECT kind, item_key, points, updated_at, updated_by
       FROM gcc_world.gs_valoraciones
      WHERE subject_kind = $1 AND subject_id = $2
      ORDER BY points DESC, item_key ASC`,
    [subjectKind, subjectId],
  );
  const out: Assessment = { talents: [], values: [], updatedAt: null, updatedBy: null };
  for (const r of rows) {
    const item = { itemKey: r.item_key, points: Number(r.points) };
    if (r.kind === 'talent') out.talents.push(item); else out.values.push(item);
    const at = new Date(r.updated_at).toISOString();
    if (!out.updatedAt || at > out.updatedAt) { out.updatedAt = at; out.updatedBy = r.updated_by ?? null; }
  }
  return out;
}

/** Valoraciones de varios sujetos a la vez (para el perfil de Reclutamiento). */
export async function getAssessments(subjectKind: string, subjectIds: string[]): Promise<Record<string, Assessment>> {
  await ensureValoracionesTables();
  const out: Record<string, Assessment> = {};
  if (subjectIds.length === 0) return out;
  const { rows } = await pool.query(
    `SELECT subject_id, kind, item_key, points, updated_at, updated_by
       FROM gcc_world.gs_valoraciones
      WHERE subject_kind = $1 AND subject_id = ANY($2::text[])
      ORDER BY points DESC, item_key ASC`,
    [subjectKind, subjectIds],
  );
  for (const r of rows) {
    const sid = String(r.subject_id);
    const a = out[sid] || (out[sid] = { talents: [], values: [], updatedAt: null, updatedBy: null });
    const item = { itemKey: r.item_key, points: Number(r.points) };
    if (r.kind === 'talent') a.talents.push(item); else a.values.push(item);
    const at = new Date(r.updated_at).toISOString();
    if (!a.updatedAt || at > a.updatedAt) { a.updatedAt = at; a.updatedBy = r.updated_by ?? null; }
  }
  return out;
}

/* ── Escritura (REEMPLAZO) ───────────────────────────────────────────────────── */

/**
 * Guarda la valoración COMPLETA del sujeto: lo que no venga en `items` se elimina, y lo que
 * venga se fija a ese valor. Todo en una transacción, para que nunca quede un estado a medias
 * (ni duplicado ni vacío) si algo falla a mitad.
 *
 * Filtra contra las listas canónicas `TALENTOS`/`VALORES`, igual que las etiquetas de tareas.
 */
export async function saveAssessment(
  subjectKind: string, subjectId: string, items: AssessmentItem[], updatedBy: string | null,
): Promise<{ saved: number }> {
  await ensureValoracionesTables();

  // Sanea: tipo válido, ítem dentro de la lista canónica, puntos en rango y sin duplicados.
  const seen = new Set<string>();
  const clean: AssessmentItem[] = [];
  for (const it of items) {
    const kind = it?.kind === 'value' ? 'value' : it?.kind === 'talent' ? 'talent' : null;
    if (!kind) continue;
    const key = String(it.itemKey ?? '').trim();
    if (!key) continue;
    if (kind === 'talent' && !TALENTOS_SET.has(key)) continue;
    if (kind === 'value' && !VALORES_SET.has(key)) continue;
    const dedup = `${kind}:${key}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    const pts = Math.round(Number(it.points));
    if (!Number.isFinite(pts)) continue;
    clean.push({ kind, itemKey: key, points: Math.max(MIN_POINTS, Math.min(MAX_POINTS, pts)) });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // REEMPLAZO en dos pasos dentro de la transacción: se borra todo lo del sujeto y se
    // reinserta el conjunto enviado. Es atómico igual que un borrado selectivo, y evita
    // construir un `record[]` con los nombres de talento (llevan espacios y acentos, así que
    // el escapado sería una fuente de errores).
    await client.query(
      `DELETE FROM gcc_world.gs_valoraciones WHERE subject_kind = $1 AND subject_id = $2`,
      [subjectKind, subjectId],
    );
    for (const c of clean) {
      await client.query(
        `INSERT INTO gcc_world.gs_valoraciones (subject_kind, subject_id, kind, item_key, points, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [subjectKind, subjectId, c.kind, c.itemKey, c.points, updatedBy],
      );
    }
    await client.query('COMMIT');
    return { saved: clean.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
