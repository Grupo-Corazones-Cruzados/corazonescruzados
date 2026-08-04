import { pool } from '@/lib/db';

/**
 * TALENTOS y PLAZAS por requerimiento.
 *
 * Antes el talento solo existía a nivel de PROYECTO (`projects.required_talents`, para
 * quien lo lidera). Ahora cada **requerimiento** lleva sus talentos y cuántas **plazas**
 * ofrece, que es lo que de verdad describe el trabajo a repartir.
 *
 * De ahí sale el filtro por talento del Marketplace y de Proyectos: un proyecto encaja si
 * **alguno de sus requerimientos** pide alguno de los talentos buscados.
 *
 * Los talentos válidos son los de la lista global `gd_talentos` (Admin ▸ Listas y sistema
 * Encuadre Condiciológico), la misma que usan tickets y proyectos.
 */

let ready = false;
let ensuring: Promise<void> | null = null;

/** Añade las columnas si faltan. Idempotente y con promise-singleton (patrón de la casa). */
export function ensureRequirementColumns(): Promise<void> {
  if (ready) return Promise.resolve();
  if (ensuring) return ensuring;
  ensuring = (async () => {
    await pool.query(`ALTER TABLE gcc_world.project_requirements ADD COLUMN IF NOT EXISTS talents TEXT[] NOT NULL DEFAULT '{}'`);
    await pool.query(`ALTER TABLE gcc_world.project_requirements ADD COLUMN IF NOT EXISTS slots INT DEFAULT 1`);
    // Las plazas pueden quedar SIN DEFINIR (NULL): el agente de cotizaciones no las decide,
    // las pone una persona al revisar el requerimiento.
    await pool.query(`ALTER TABLE gcc_world.project_requirements ALTER COLUMN slots DROP NOT NULL`).catch(() => {});
    // Índice GIN: el filtro por talento hace `talents && ARRAY[...]` sobre todos los
    // requerimientos, y sin él sería un recorrido completo de la tabla.
    await pool.query(`CREATE INDEX IF NOT EXISTS project_requirements_talents_idx ON gcc_world.project_requirements USING GIN (talents)`);
    ready = true;
  })().finally(() => { ensuring = null; });
  return ensuring;
}

/** Limpia la lista recibida: strings no vacíos, sin repetidos y con un tope razonable. */
export function normalizeTalents(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

/** Plazas: entero ≥ 1, o `null` = sin definir (lo que deja el agente de cotizaciones). */
export function normalizeSlots(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null;
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 999);
}

/**
 * Talentos que pide un proyecto = unión de los de sus requerimientos.
 * Devuelve un mapa `projectId -> string[]` para no consultar uno por uno.
 */
export async function talentsByProject(projectIds: (number | string)[]): Promise<Record<string, string[]>> {
  if (!projectIds.length) return {};
  await ensureRequirementColumns();
  const { rows } = await pool.query(
    `SELECT project_id, ARRAY(SELECT DISTINCT UNNEST(ARRAY_AGG(t)) ORDER BY 1) AS talents
       FROM gcc_world.project_requirements r, UNNEST(r.talents) AS t
      WHERE r.project_id = ANY($1::bigint[])
      GROUP BY project_id`,
    [projectIds.map((p) => Number(p))],
  );
  return Object.fromEntries(rows.map((r: any) => [String(r.project_id), r.talents as string[]]));
}

/**
 * Fragmento SQL para filtrar proyectos por talento. Se devuelve el texto y el valor para
 * que quien llama lo encaje en su propia lista de parámetros.
 * `alias` es el alias de la tabla `projects` en la consulta destino.
 */
export function talentFilterSql(alias: string, paramIndex: number): string {
  return `EXISTS (
    SELECT 1 FROM gcc_world.project_requirements pr
     WHERE pr.project_id = ${alias}.id AND pr.talents && $${paramIndex}::text[]
  )`;
}

/**
 * Fragmento SQL con los talentos de un proyecto (unión de los de sus requerimientos),
 * como `text[]` ordenado y sin repetidos. `alias` es el alias de `projects` en la consulta.
 *
 * ⚠ Se DESANIDA antes de agregar. `ARRAY_AGG(r.talents)` sobre un `text[]` construye una
 * matriz 2-D y Postgres exige que todas las filas tengan la MISMA longitud: en cuanto un
 * proyecto tiene un requerimiento con 2 talentos y otro con 3, la consulta entera muere con
 * «cannot accumulate arrays of different dimensionality». Pasó en producción el 2026-08-04.
 */
export function talentsAggSql(alias: string): string {
  return `COALESCE((
    SELECT ARRAY(
      SELECT DISTINCT t
        FROM gcc_world.project_requirements r, UNNEST(r.talents) AS t
       WHERE r.project_id = ${alias}.id
       ORDER BY 1
    )
  ), '{}')`;
}
