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
  await ensureGeneratedTasksTable();
  await ensureSystemSeed();
  ready = true;
}

/**
 * Tabla de TAREAS GENERADAS por políticas (enforcement de la función `generate_tasks`).
 * Cada fila es una instancia por (función · programa · sujeto · día): la tarea aterriza en
 * el "Mi día" del sujeto y en su Horario de Vida como una entrada FIJA (como las de
 * ticket/proyecto). El usuario solo cambia su `status` y sus etiquetas (`value_tags`/
 * `talent_tags`). Se materializa al ACTIVAR la política y se limpia al desactivarla.
 * La expuesta también la crea el Horario de Vida al leer, por eso vive en su propia función.
 */
export async function ensureGeneratedTasksTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.cv_generated_tasks (
      id BIGSERIAL PRIMARY KEY,
      function_id INT NOT NULL REFERENCES gcc_world.cv_functions(id) ON DELETE CASCADE,
      policy_id INT NOT NULL,
      program_idx INT NOT NULL,                 -- índice del TaskProgram dentro de la función
      subject_kind TEXT NOT NULL,               -- 'member' | 'candidate'
      subject_id TEXT NOT NULL,                 -- members.id | clients.id (como texto)
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      value_tags TEXT[] NOT NULL DEFAULT '{}',
      talent_tags TEXT[] NOT NULL DEFAULT '{}',
      all_day BOOLEAN NOT NULL DEFAULT FALSE,
      start_time TEXT,
      end_time TEXT,
      day DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'completed' | 'failed'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (function_id, subject_kind, subject_id, program_idx, day)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS cv_generated_subject_idx ON gcc_world.cv_generated_tasks (subject_kind, subject_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS cv_generated_policy_idx ON gcc_world.cv_generated_tasks (policy_id)`);
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

export async function renameCategory(id: number, name: string) {
  await ensureComandosTables();
  await pool.query(`UPDATE gcc_world.cv_categories SET name = $1 WHERE id = $2`, [name.trim(), id]);
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
  // Enforcement de la función `generate_tasks`: al activar se materializan las tareas
  // programadas en el horario de cada usuario; al desactivar se retiran las pendientes.
  if (active) await materializePolicyTasks(id);
  else await removePolicyPendingTasks(id);
}

/**
 * Materializa (idempotente) las tareas de todas las funciones `generate_tasks` de la
 * política: por cada TaskProgram expande los días desde la FECHA DE ACTIVACIÓN durante
 * `daysCount` días, filtrando por `weekdays` (vacío = todos), e inserta una fila por día.
 * `ON CONFLICT DO NOTHING` evita duplicar días ya existentes (re-activación / solape).
 */
export async function materializePolicyTasks(policyId: number): Promise<void> {
  await ensureGeneratedTasksTable();
  const startDay = await getPolicyStartDay(policyId);
  if (!startDay) return;
  const { rows: fns } = await pool.query(
    `SELECT id, config FROM gcc_world.cv_functions WHERE policy_id = $1 AND type = 'generate_tasks'`,
    [policyId],
  );
  for (const fn of fns) await materializeFunctionTasks(policyId, Number(fn.id), fn.config, startDay);
}

/** Fecha de activación (día local) de la política, o null si no está activada. */
async function getPolicyStartDay(policyId: number): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT to_char((activated_at AT TIME ZONE 'America/Guayaquil')::date, 'YYYY-MM-DD') AS start_day
       FROM gcc_world.cv_policies WHERE id = $1`,
    [policyId],
  );
  return rows[0]?.start_day || null;
}

/** Inserta (idempotente) los días de UN TaskProgram para UN sujeto. */
async function insertGeneratedForSubject(functionId: number, policyId: number, idx: number, t: any, kind: string, id: string, startDay: string) {
  const days = Math.max(1, Number(t.daysCount) || 1);
  const weekdays: number[] = Array.isArray(t.weekdays) ? t.weekdays.map(Number) : [];
  await pool.query(
    `INSERT INTO gcc_world.cv_generated_tasks
       (function_id, policy_id, program_idx, subject_kind, subject_id, title, detail,
        value_tags, talent_tags, all_day, start_time, end_time, day, status)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8::text[], $9::text[], $10, $11, $12, d::date, 'pending'
       FROM generate_series($13::date, $13::date + ($14 - 1) * INTERVAL '1 day', INTERVAL '1 day') AS d
      WHERE ($15::int[] = '{}'::int[] OR EXTRACT(DOW FROM d)::int = ANY($15::int[]))
     ON CONFLICT (function_id, subject_kind, subject_id, program_idx, day) DO NOTHING`,
    [
      functionId, policyId, idx, kind, id,
      String(t.title), String(t.detail || ''),
      Array.isArray(t.valores) ? t.valores.map(String) : [],
      Array.isArray(t.talentos) ? t.talentos.map(String) : [],
      !!t.allDay, t.allDay ? null : String(t.startTime || ''), t.allDay ? null : String(t.endTime || ''),
      startDay, days, weekdays,
    ],
  );
}

/** Materializa todas las tareas (TaskProgram[]) de UNA función `generate_tasks`. */
async function materializeFunctionTasks(policyId: number, functionId: number, config: any, startDay: string): Promise<void> {
  const tasks: any[] = Array.isArray(config?.tasks) ? config.tasks : [];
  let allSubjects: { kind: string; id: string }[] | null = null;
  for (let idx = 0; idx < tasks.length; idx++) {
    const t = tasks[idx];
    if (!t?.title) continue;
    if (t.scope === 'all') {
      if (!allSubjects) allSubjects = await getAllTaskSubjects();
      for (const s of allSubjects) await insertGeneratedForSubject(functionId, policyId, idx, t, s.kind, s.id, startDay);
    } else {
      if (!t.userKind || !t.userId) continue;
      await insertGeneratedForSubject(functionId, policyId, idx, t, String(t.userKind), String(t.userId), startDay);
    }
  }
}

/**
 * Re-sincroniza las tareas generadas de UNA función tras crear/editar su config, PERO solo
 * si su política está ACTIVA (si no, se materializan al activar). Borra las PENDIENTES de la
 * función (para que se reflejen ediciones/eliminaciones) y regenera desde la config actual
 * (los días ya completados/fallidos se conservan gracias al ON CONFLICT DO NOTHING). No hace
 * nada para funciones que no son `generate_tasks`.
 */
export async function resyncFunctionTasks(functionId: number): Promise<void> {
  await ensureGeneratedTasksTable();
  const { rows } = await pool.query(
    `SELECT f.policy_id, f.type, f.config, p.active,
            to_char((p.activated_at AT TIME ZONE 'America/Guayaquil')::date, 'YYYY-MM-DD') AS start_day
       FROM gcc_world.cv_functions f
       JOIN gcc_world.cv_policies p ON p.id = f.policy_id
      WHERE f.id = $1`,
    [functionId],
  );
  const r = rows[0];
  if (!r || r.type !== 'generate_tasks' || !r.active || !r.start_day) return;
  await pool.query(`DELETE FROM gcc_world.cv_generated_tasks WHERE function_id = $1 AND status = 'pending'`, [functionId]);
  await materializeFunctionTasks(Number(r.policy_id), functionId, r.config, r.start_day);
}

/**
 * Sujetos que cuentan como "todos los usuarios" para las tareas de alcance 'all':
 * miembros ACTIVOS (subject_id = members.id) + candidatos APROBADOS con perfil completo
 * (subject_id = clients.id). Coincide con quién aparece en `UsersList`
 * (/api/admin/team activos + /api/admin/candidates).
 */
async function getAllTaskSubjects(): Promise<{ kind: string; id: string }[]> {
  const { rows } = await pool.query(
    `SELECT 'member' AS kind, id::text AS id FROM gcc_world.members WHERE is_active = true
     UNION ALL
     SELECT 'candidate' AS kind, id::text AS id FROM gcc_world.clients
       WHERE account_type = 'candidate' AND approved = true AND profile_completed = true`,
  );
  return rows.map((r: any) => ({ kind: String(r.kind), id: String(r.id) }));
}

/** Al desactivar: retira las tareas PENDIENTES (pasadas y futuras); conserva el historial
 *  de las completadas/fallidas para el registro y el scoring del perfil. */
export async function removePolicyPendingTasks(policyId: number): Promise<void> {
  await ensureGeneratedTasksTable();
  await pool.query(
    `DELETE FROM gcc_world.cv_generated_tasks WHERE policy_id = $1 AND status = 'pending'`,
    [policyId],
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
  // Si la política ya está activa, materializa de una vez las tareas de esta función.
  await resyncFunctionTasks(Number(rows[0].id));
  return rows[0];
}

export async function updateFunctionConfig(id: number, config: any) {
  await ensureComandosTables();
  await pool.query(`UPDATE gcc_world.cv_functions SET config = $1::jsonb WHERE id = $2`, [JSON.stringify(config || {}), id]);
  // Refleja los cambios en las tareas ya generadas (Mi día / Horario de Vida) si la política está activa.
  await resyncFunctionTasks(Number(id));
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

/* ── Efectos ACTIVOS (enforcement) ──────────────────────────────────────────── */
/**
 * Agrega los efectos "en vivo" de todas las políticas ACTIVAS: mensajes permanentes y
 * módulos bloqueados. (La generación de tareas se aplica aparte, al activar.)
 */
export interface PolicyDetailDoc { id: number; title: string; purpose: string; conduct: string; clauses: { title: string; text: string }[] }
export interface ActivePolicy { id: number; name: string; activatedAt: string | null; messages: string[]; details: PolicyDetailDoc[] }

/**
 * Efectos "en vivo" agrupados POR POLÍTICA activa: mensajes permanentes y documentos de
 * detalle (términos) de cada una, más los módulos bloqueados (agregados globalmente).
 * Solo se devuelven políticas con algo que comunicar (mensaje o detalle).
 */
export async function getActiveEffects(): Promise<{ policies: ActivePolicy[]; blockedModules: string[] }> {
  await ensureComandosTables();
  const { rows } = await pool.query(
    `SELECT p.id AS policy_id, p.name, p.activated_at, f.id AS fn_id, f.type, f.config
       FROM gcc_world.cv_policies p
       JOIN gcc_world.cv_functions f ON f.policy_id = p.id
      WHERE p.active = true
      ORDER BY p.activated_at DESC NULLS LAST, p.id ASC, f.created_at ASC`,
  );
  const map = new Map<number, ActivePolicy>();
  const blocked = new Set<string>();
  for (const r of rows) {
    let pol = map.get(r.policy_id);
    if (!pol) {
      pol = { id: r.policy_id, name: r.name, activatedAt: r.activated_at ? new Date(r.activated_at).toISOString() : null, messages: [], details: [] };
      map.set(r.policy_id, pol);
    }
    if (r.type === 'permanent_message') {
      const m = String(r.config?.message || '').trim();
      if (m) pol.messages.push(m);
    } else if (r.type === 'policy_terms') {
      const c = r.config || {};
      pol.details.push({ id: Number(r.fn_id), title: String(c.title || 'Detalle'), purpose: String(c.purpose || ''), conduct: String(c.conduct || ''), clauses: Array.isArray(c.clauses) ? c.clauses : [] });
    } else if (r.type === 'block_modules') {
      for (const path of r.config?.modules || []) blocked.add(String(path));
    }
  }
  const policies = Array.from(map.values()).filter((p) => p.messages.length > 0 || p.details.length > 0);
  return { policies, blockedModules: Array.from(blocked) };
}
