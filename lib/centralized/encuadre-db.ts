// Capa de datos del sistema "Encuadre Condiciológico". Hogar de las LISTAS GLOBALES
// (talentos, valores, situaciones, materias y futuras). Cada lista es una tabla simple
// (id + nombre); talentos/valores se siembran idempotentes desde las listas estáticas.
// Situaciones/materias reusan las tablas de Gestión de Datos (referenciadas por id allí).
import { pool } from '@/lib/db';
import { ensureGestionDatosTables } from '@/lib/centralized/gestion-datos-db';
import { TALENTOS } from '@/lib/centralized/talentos';
import { VALORES } from '@/lib/centralized/valores';

// Registro de listas globales. table/col son CONSTANTES (no entran del usuario) → SQL seguro.
export const GLOBAL_LISTS = {
  talentos:    { label: 'Talentos',    table: 'gd_talentos',    col: 'nombre' },
  valores:     { label: 'Valores',     table: 'gd_valores',     col: 'nombre' },
  situaciones: { label: 'Situaciones', table: 'gd_situaciones', col: 'nombre' },
  materias:    { label: 'Materias',    table: 'gd_materias',    col: 'nombre' },
} as const;
export type GlobalListKey = keyof typeof GLOBAL_LISTS;

function meta(key: string) {
  const m = (GLOBAL_LISTS as any)[key];
  if (!m) throw new Error('Lista desconocida.');
  return m as { label: string; table: string; col: string };
}

let ready = false;
export async function ensureEncuadreTables(): Promise<void> {
  if (ready) return;
  await ensureGestionDatosTables(); // gd_situaciones / gd_materias
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.gd_talentos (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.gd_valores  (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())`);
  // Siembra idempotente desde las listas estáticas (solo si la tabla está vacía).
  const { rows: [t] } = await pool.query(`SELECT COUNT(*)::int AS n FROM gcc_world.gd_talentos`);
  if (t.n === 0 && TALENTOS.length) {
    await pool.query(`INSERT INTO gcc_world.gd_talentos (nombre) SELECT DISTINCT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING`, [TALENTOS]);
  }
  const { rows: [v] } = await pool.query(`SELECT COUNT(*)::int AS n FROM gcc_world.gd_valores`);
  if (v.n === 0 && VALORES.length) {
    await pool.query(`INSERT INTO gcc_world.gd_valores (nombre) SELECT DISTINCT unnest($1::text[]) ON CONFLICT (nombre) DO NOTHING`, [VALORES]);
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

/** Opciones de una lista, ordenadas ASCENDENTE por nombre (case-insensitive). */
export async function getListOptions(key: string) {
  await ensureEncuadreTables();
  const m = meta(key);
  const { rows } = await pool.query(
    `SELECT id, ${m.col} AS label FROM gcc_world.${m.table} ORDER BY LOWER(${m.col}) ASC`,
  );
  return rows;
}

/** Agrega una opción (evita duplicados case-insensitive). */
export async function addListOption(key: string, value: string) {
  await ensureEncuadreTables();
  const m = meta(key);
  const val = (value || '').trim();
  if (!val) throw new Error('El nombre es requerido.');
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.${m.table} (${m.col})
       SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM gcc_world.${m.table} WHERE LOWER(${m.col}) = LOWER($1))
     RETURNING id, ${m.col} AS label`,
    [val],
  );
  if (rows.length === 0) throw new Error('Esa opción ya existe.');
  return rows[0];
}

export async function deleteListOption(key: string, id: number) {
  await ensureEncuadreTables();
  const m = meta(key);
  await pool.query(`DELETE FROM gcc_world.${m.table} WHERE id = $1`, [id]);
}
