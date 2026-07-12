// Capa de datos del sistema "Encuadre Condiciológico". Hogar de las LISTAS GLOBALES
// (talentos, valores, situaciones, materias y futuras).
//  - Listas "simple": una sola columna de texto (nombre). talentos/situaciones/materias.
//  - Listas "keyed": dos propiedades internas key+label (p.ej. valores, que se referencian
//    por `key`). En la UI se edita UN solo campo: lo escrito va a `label` y `key` = slug
//    normalizado en minúscula.
import { pool } from '@/lib/db';
import { ensureGestionDatosTables } from '@/lib/centralized/gestion-datos-db';
import { TALENTOS } from '@/lib/centralized/talentos';
import { VALORES } from '@/lib/centralized/valores';

type SimpleList = { label: string; table: string; shape: 'simple'; col: string };
type KeyedList = { label: string; table: string; shape: 'keyed'; keyCol: string; labelCol: string };
type ListMeta = SimpleList | KeyedList;

// table/columnas son CONSTANTES (no entran del usuario) → SQL seguro al interpolarlas.
export const GLOBAL_LISTS: Record<string, ListMeta> = {
  talentos:            { label: 'Talentos',          table: 'gd_talentos',           shape: 'simple', col: 'nombre' },
  valores:             { label: 'Valores',           table: 'gd_valores',            shape: 'keyed', keyCol: 'key', labelCol: 'label' },
  situaciones:         { label: 'Situaciones',       table: 'gd_situaciones',        shape: 'simple', col: 'nombre' },
  materias:            { label: 'Materias',          table: 'gd_materias',           shape: 'simple', col: 'nombre' },
  acciones:            { label: 'Acciones',          table: 'gd_acciones',           shape: 'simple', col: 'nombre' },
  intenciones:         { label: 'Intenciones',       table: 'gd_intenciones',        shape: 'simple', col: 'nombre' },
  estados:             { label: 'Estados',           table: 'gd_estados',            shape: 'simple', col: 'nombre' },
  lugares:             { label: 'Lugares',           table: 'gd_lugares',            shape: 'simple', col: 'nombre' },
  procesos_mentales:   { label: 'Procesos mentales', table: 'gd_procesos_mentales',  shape: 'simple', col: 'nombre' },
  moldes:              { label: 'Moldes',            table: 'gd_moldes',             shape: 'simple', col: 'nombre' },
};
export type GlobalListKey = keyof typeof GLOBAL_LISTS;

function meta(key: string): ListMeta {
  const m = GLOBAL_LISTS[key];
  if (!m) throw new Error('Lista desconocida.');
  return m;
}

/** key normalizada: minúsculas, sin acentos, solo [a-z0-9_]. */
export function slugKey(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

let ready = false;
export async function ensureEncuadreTables(): Promise<void> {
  if (ready) return;
  await ensureGestionDatosTables(); // gd_situaciones / gd_materias

  // Talentos (simple).
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.gd_talentos (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`);
  const { rows: [t] } = await pool.query(`SELECT COUNT(*)::int AS n FROM gcc_world.gd_talentos`);
  if (t.n === 0 && TALENTOS.length) {
    await pool.query(`INSERT INTO gcc_world.gd_talentos (nombre) SELECT DISTINCT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING`, [TALENTOS]);
  }

  // Valores (keyed: key + label). Migra el esquema/datos viejos si existieran.
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.gd_valores (id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await pool.query(`ALTER TABLE gcc_world.gd_valores ADD COLUMN IF NOT EXISTS key TEXT`);
  await pool.query(`ALTER TABLE gcc_world.gd_valores ADD COLUMN IF NOT EXISTS label TEXT`);
  try { await pool.query(`ALTER TABLE gcc_world.gd_valores ALTER COLUMN nombre DROP NOT NULL`); } catch { /* no existe la col nombre en instalaciones nuevas */ }
  // Limpia filas mal sembradas antes (sin label → eran JSON en `nombre`).
  await pool.query(`DELETE FROM gcc_world.gd_valores WHERE label IS NULL OR label = ''`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gd_valores_key_key ON gcc_world.gd_valores (LOWER(key))`);
  const { rows: [v] } = await pool.query(`SELECT COUNT(*)::int AS n FROM gcc_world.gd_valores`);
  if (v.n === 0 && Array.isArray(VALORES) && VALORES.length) {
    for (const val of VALORES as any[]) {
      const label = String(val?.label ?? val ?? '').trim();
      const key = String(val?.key ?? slugKey(label));
      if (label) await pool.query(`INSERT INTO gcc_world.gd_valores (key, label) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [key, label]);
    }
  }

  // Listas simple SIN semilla (nacen vacías): acciones, intenciones, estados, lugares,
  // procesos_mentales, moldes. Se crean sus tablas idempotentes.
  for (const key of ['gd_acciones', 'gd_intenciones', 'gd_estados', 'gd_lugares', 'gd_procesos_mentales', 'gd_moldes']) {
    await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.${key} (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`);
  }

  ready = true;
}

/** Listas disponibles con su conteo de opciones. */
export async function listGlobalLists() {
  await ensureEncuadreTables();
  const out = [];
  for (const [key, m] of Object.entries(GLOBAL_LISTS)) {
    const { rows: [c] } = await pool.query(`SELECT COUNT(*)::int AS n FROM gcc_world.${m.table}`);
    out.push({ key, label: m.label, count: c.n });
  }
  return out;
}

/** Opciones de una lista, ordenadas ASC por el texto visible. Devuelve {id, label, key?}. */
export async function getListOptions(key: string) {
  await ensureEncuadreTables();
  const m = meta(key);
  if (m.shape === 'keyed') {
    const { rows } = await pool.query(
      `SELECT id, ${m.labelCol} AS label, ${m.keyCol} AS key FROM gcc_world.${m.table} ORDER BY LOWER(${m.labelCol}) ASC`,
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT id, ${m.col} AS label FROM gcc_world.${m.table} ORDER BY LOWER(${m.col}) ASC`,
  );
  return rows;
}

/** Agrega una opción. En listas keyed: key = slug(minúsculas) del texto, label = texto. */
export async function addListOption(key: string, value: string) {
  await ensureEncuadreTables();
  const m = meta(key);
  const label = (value || '').trim();
  if (!label) throw new Error('El nombre es requerido.');
  if (m.shape === 'keyed') {
    const k = slugKey(label);
    if (!k) throw new Error('Nombre inválido.');
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.${m.table} (${m.keyCol}, ${m.labelCol})
         SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM gcc_world.${m.table} WHERE LOWER(${m.keyCol}) = LOWER($1) OR LOWER(${m.labelCol}) = LOWER($2))
       RETURNING id, ${m.labelCol} AS label, ${m.keyCol} AS key`,
      [k, label],
    );
    if (rows.length === 0) throw new Error('Esa opción ya existe.');
    return rows[0];
  }
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.${m.table} (${m.col})
       SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM gcc_world.${m.table} WHERE LOWER(${m.col}) = LOWER($1))
     RETURNING id, ${m.col} AS label`,
    [label],
  );
  if (rows.length === 0) throw new Error('Esa opción ya existe.');
  return rows[0];
}

export async function deleteListOption(key: string, id: number) {
  await ensureEncuadreTables();
  const m = meta(key);
  await pool.query(`DELETE FROM gcc_world.${m.table} WHERE id = $1`, [id]);
}
