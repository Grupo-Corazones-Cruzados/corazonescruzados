import { pool } from '@/lib/db';
import { FUNCTION_SHORT, policyKey, type PolicyGraph, type FunctionType } from '@/lib/centralized/comandos';

/**
 * Capa de datos de "Comandos Violeta". Tablas con prefijo `cv_`:
 *   cv_categories  → categorías (panel izquierdo)
 *   cv_policies    → políticas por categoría (activables)
 *   cv_functions   → funciones de cada política (type + config jsonb)
 * Además siembra idempotente el sistema built-in en centralized_systems.
 */
let ready = false;

export async function ensureComandosTables(): Promise<void> {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.cv_categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.cv_policies (
      id SERIAL PRIMARY KEY,
      category_id INT NOT NULL REFERENCES gcc_world.cv_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT false,
      activated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.cv_functions (
      id SERIAL PRIMARY KEY,
      policy_id INT NOT NULL REFERENCES gcc_world.cv_policies(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS cv_policies_category_idx ON gcc_world.cv_policies(category_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS cv_functions_policy_idx ON gcc_world.cv_functions(policy_id)`);
  await ensureSystemSeed();
  ready = true;
}

/** Siembra el sistema built-in "Comandos Violeta" (global · creación) si no existe. */
async function ensureSystemSeed(): Promise<void> {
  // La tabla de sistemas se crea en la ruta de systems; garantiza su existencia por si
  // aún no se cargó ninguna página de Centralizado.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.centralized_systems (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      piso VARCHAR(30) NOT NULL,
      paso VARCHAR(30) NOT NULL,
      cell_name VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      slug VARCHAR(220)
    )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS centralized_systems_slug_key ON gcc_world.centralized_systems(slug)`);
  await pool.query(
    `INSERT INTO gcc_world.centralized_systems (name, description, piso, paso, cell_name, slug)
     SELECT 'Comandos Violeta',
            'Configura modelos organizacionales: políticas activables por categoría, cada una con funciones (mensaje permanente, bloqueo de módulos, generación de tareas) que actúan en toda la app.',
            'global', 'creacion', 'Control Psicosocial', 'comandos-violeta'
     WHERE NOT EXISTS (SELECT 1 FROM gcc_world.centralized_systems WHERE slug = 'comandos-violeta')`,
  );
}

/* ── Categorías ─────────────────────────────────────────────────────────────── */
export async function listCategories() {
  await ensureComandosTables();
  const { rows } = await pool.query(
    `SELECT c.id, c.name, COALESCE(p.cnt, 0)::int AS policy_count
       FROM gcc_world.cv_categories c
       LEFT JOIN (SELECT category_id, COUNT(*) AS cnt FROM gcc_world.cv_policies GROUP BY category_id) p
         ON p.category_id = c.id
      ORDER BY c.name ASC`,
  );
  return rows;
}

export async function createCategory(name: string) {
  await ensureComandosTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.cv_categories (name) VALUES ($1) RETURNING id, name`,
    [name.trim()],
  );
  return rows[0];
}

export async function deleteCategory(id: number) {
  await ensureComandosTables();
  await pool.query(`DELETE FROM gcc_world.cv_categories WHERE id = $1`, [id]);
}

/* ── Grafo de una categoría (políticas → funciones) ─────────────────────────── */
export async function getCategoryGraph(categoryId: number): Promise<PolicyGraph> {
  await ensureComandosTables();
  const { rows: policies } = await pool.query(
    `SELECT id, name, active FROM gcc_world.cv_policies WHERE category_id = $1 ORDER BY created_at ASC`,
    [categoryId],
  );
  const policyIds = policies.map((p: any) => p.id);
  const { rows: functions } = policyIds.length
    ? await pool.query(
        `SELECT id, policy_id, type FROM gcc_world.cv_functions WHERE policy_id = ANY($1::int[]) ORDER BY created_at ASC`,
        [policyIds],
      )
    : { rows: [] as any[] };

  const nodes: PolicyGraph['nodes'] = [
    ...policies.map((p: any) => ({ key: policyKey('policy', p.id), type: 'policy' as const, id: p.id, title: p.name, active: p.active })),
    ...functions.map((f: any) => ({ key: policyKey('function', f.id), type: 'function' as const, id: f.id, title: FUNCTION_SHORT[f.type as FunctionType] || 'Función', functionType: f.type as FunctionType })),
  ];
  const edges: PolicyGraph['edges'] = functions.map((f: any) => ({ source: policyKey('policy', f.policy_id), target: policyKey('function', f.id) }));
  return { nodes, edges };
}

/* ── Políticas ──────────────────────────────────────────────────────────────── */
export async function createPolicy(categoryId: number, name: string) {
  await ensureComandosTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.cv_policies (category_id, name) VALUES ($1, $2) RETURNING id`,
    [categoryId, name.trim()],
  );
  return rows[0];
}

export async function setPolicyActive(id: number, active: boolean) {
  await ensureComandosTables();
  await pool.query(
    `UPDATE gcc_world.cv_policies SET active = $1, activated_at = CASE WHEN $1 THEN NOW() ELSE activated_at END WHERE id = $2`,
    [active, id],
  );
}

export async function deletePolicy(id: number) {
  await ensureComandosTables();
  await pool.query(`DELETE FROM gcc_world.cv_policies WHERE id = $1`, [id]);
}

/* ── Funciones ──────────────────────────────────────────────────────────────── */
export async function createFunction(policyId: number, type: string, config: any) {
  await ensureComandosTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.cv_functions (policy_id, type, config) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [policyId, type, JSON.stringify(config || {})],
  );
  return rows[0];
}

export async function updateFunctionConfig(id: number, config: any) {
  await ensureComandosTables();
  await pool.query(`UPDATE gcc_world.cv_functions SET config = $1::jsonb WHERE id = $2`, [JSON.stringify(config || {}), id]);
}

export async function getFunction(id: number) {
  await ensureComandosTables();
  const { rows } = await pool.query(`SELECT id, policy_id, type, config FROM gcc_world.cv_functions WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function deleteFunction(id: number) {
  await ensureComandosTables();
  await pool.query(`DELETE FROM gcc_world.cv_functions WHERE id = $1`, [id]);
}
