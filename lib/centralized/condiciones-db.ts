// Capa de datos del sistema "Gestión de Condiciones" (controlador · fundamentación).
// Prefijos: dc_ (catálogo de variables de Dinámica Condiciológica) y gc_ (condiciones).
// Recibe tareas de Metodología (mc_tasks) y completa la pieza (gd_piezas) con las variables
// descubiertas + eventos de verificación + restricciones.
import { pool } from '@/lib/db';
import { ensureGestionDatosTables, getCodigoDetalle } from '@/lib/centralized/gestion-datos-db';
import { ensureMetodologiaTables } from '@/lib/centralized/metodologia-db';

let ready = false;

export async function ensureCondicionesTables(): Promise<void> {
  if (ready) return;
  await ensureGestionDatosTables();  // gd_piezas / gd_pieza_variables / gd_codigos
  await ensureMetodologiaTables();   // mc_tasks / mc_task_codigos / mc_task_pieza

  // Catálogo de variables (lo gestionará el futuro sistema Dinámica Condiciológica): factor→causa→variable.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.dc_variables (
      id SERIAL PRIMARY KEY,
      factor TEXT NOT NULL,          -- 'mental' | 'corporal' | 'ambiental'
      causa TEXT NOT NULL,
      nombre TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  // Condición descubierta al trabajar una pieza (registro de condición).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gc_condiciones (
      id SERIAL PRIMARY KEY,
      pieza_id INT NOT NULL REFERENCES gcc_world.gd_piezas(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      verificada BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gc_condiciones_pieza_idx ON gcc_world.gc_condiciones(pieza_id)`);

  // Variables de una condición: fijas (texto propio) o del catálogo (dc_variables).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gc_condicion_variables (
      id SERIAL PRIMARY KEY,
      condicion_id INT NOT NULL REFERENCES gcc_world.gc_condiciones(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'fija',     -- 'fija' | 'catalogo'
      variable_id INT REFERENCES gcc_world.dc_variables(id) ON DELETE SET NULL,
      nombre TEXT NOT NULL,
      factor TEXT NOT NULL,
      causa TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gc_condicion_variables_cond_idx ON gcc_world.gc_condicion_variables(condicion_id)`);

  // Eventos de demostración que verifican la condición.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gc_condicion_eventos (
      id SERIAL PRIMARY KEY,
      condicion_id INT NOT NULL REFERENCES gcc_world.gc_condiciones(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  // Restricciones de la condición (limitan la unión de piezas en rompecabezas).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gc_condicion_restricciones (
      id SERIAL PRIMARY KEY,
      condicion_id INT NOT NULL REFERENCES gcc_world.gc_condiciones(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,                    -- 'no_junto_con' | 'aplica_mas_de_uno' | 'solo_categorias'
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

  ready = true;
}

// ── Bandeja de tareas (todas las de Metodología, ascendente) ──────────────────
export async function listAllTasks() {
  await ensureCondicionesTables();
  const { rows } = await pool.query(
    `SELECT t.id, t.titulo, t.notas, t.estado, t.created_at,
            rp.name AS proyecto,
            (SELECT COUNT(*) FROM gcc_world.mc_task_codigos tc WHERE tc.task_id = t.id)::int AS codigos_count,
            (SELECT pieza_id FROM gcc_world.mc_task_pieza mp WHERE mp.task_id = t.id) AS pieza_id
       FROM gcc_world.mc_tasks t
       JOIN gcc_world.mc_research_projects rp ON rp.id = t.research_project_id
      ORDER BY t.created_at ASC`,
  );
  return rows;
}

export async function getTaskCodigos(taskId: number) {
  await ensureCondicionesTables();
  const { rows } = await pool.query(`SELECT codigo_id FROM gcc_world.mc_task_codigos WHERE task_id = $1 ORDER BY id ASC`, [taskId]);
  const out = [];
  for (const r of rows) {
    const d = await getCodigoDetalle(r.codigo_id);
    if (d) out.push(d);
  }
  return out;
}

// ── Catálogo de variables (Dinámica Condiciológica, provisional aquí) ─────────
export async function listVariablesCatalogo() {
  await ensureCondicionesTables();
  const { rows } = await pool.query(`SELECT id, factor, causa, nombre FROM gcc_world.dc_variables ORDER BY factor ASC, causa ASC, nombre ASC`);
  return rows;
}
export async function createVariableCatalogo(factor: string, causa: string, nombre: string) {
  await ensureCondicionesTables();
  const { rows } = await pool.query(`INSERT INTO gcc_world.dc_variables (factor, causa, nombre) VALUES ($1, $2, $3) RETURNING *`, [factor, causa, nombre.trim()]);
  return rows[0];
}
export async function deleteVariableCatalogo(id: number) {
  await ensureCondicionesTables();
  await pool.query(`DELETE FROM gcc_world.dc_variables WHERE id = $1`, [id]);
}

// ── Workspace de la pieza ─────────────────────────────────────────────────────
export async function getPiezaWorkspace(piezaId: number) {
  await ensureCondicionesTables();
  const { rows: pz } = await pool.query(`SELECT id, problematica_id, tipo, estado FROM gcc_world.gd_piezas WHERE id = $1`, [piezaId]);
  const pieza = pz[0];
  if (!pieza) return null;
  const { rows: pcods } = await pool.query(`SELECT codigo_id FROM gcc_world.gd_pieza_codigos WHERE pieza_id = $1`, [piezaId]);
  const condiciones = await listCondiciones(piezaId);
  return { ...pieza, codigoIds: pcods.map((r: any) => r.codigo_id), condiciones };
}

export async function setPiezaTipo(piezaId: number, tipo: 'revision' | 'correccion') {
  await ensureCondicionesTables();
  await pool.query(`UPDATE gcc_world.gd_piezas SET tipo = $1 WHERE id = $2`, [tipo, piezaId]);
}

export async function setPiezaCodigos(piezaId: number, codigoIds: number[]) {
  await ensureCondicionesTables();
  await pool.query(`DELETE FROM gcc_world.gd_pieza_codigos WHERE pieza_id = $1`, [piezaId]);
  for (const cid of codigoIds || []) await pool.query(`INSERT INTO gcc_world.gd_pieza_codigos (pieza_id, codigo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [piezaId, cid]);
}

// ── Condiciones ───────────────────────────────────────────────────────────────
export async function listCondiciones(piezaId: number) {
  await ensureCondicionesTables();
  const { rows } = await pool.query(`SELECT id, nombre, verificada, created_at FROM gcc_world.gc_condiciones WHERE pieza_id = $1 ORDER BY created_at ASC`, [piezaId]);
  const out = [];
  for (const c of rows) {
    const { rows: vars } = await pool.query(`SELECT id, kind, variable_id, nombre, factor, causa FROM gcc_world.gc_condicion_variables WHERE condicion_id = $1 ORDER BY id ASC`, [c.id]);
    const { rows: eventos } = await pool.query(`SELECT id, titulo, url FROM gcc_world.gc_condicion_eventos WHERE condicion_id = $1 ORDER BY id ASC`, [c.id]);
    const { rows: restr } = await pool.query(`SELECT id, tipo, config FROM gcc_world.gc_condicion_restricciones WHERE condicion_id = $1 ORDER BY id ASC`, [c.id]);
    out.push({ ...c, variables: vars, eventos, restricciones: restr });
  }
  return out;
}

export async function createCondicion(piezaId: number, nombre: string) {
  await ensureCondicionesTables();
  if (!nombre?.trim()) throw new Error('El nombre de la condición es requerido.');
  const { rows } = await pool.query(`INSERT INTO gcc_world.gc_condiciones (pieza_id, nombre) VALUES ($1, $2) RETURNING *`, [piezaId, nombre.trim()]);
  return rows[0];
}
export async function updateCondicion(id: number, nombre?: string, verificada?: boolean) {
  await ensureCondicionesTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (nombre != null) { sets.push(`nombre = $${params.length + 1}`); params.push(nombre.trim()); }
  if (verificada != null) { sets.push(`verificada = $${params.length + 1}`); params.push(!!verificada); }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.gc_condiciones SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}
export async function deleteCondicion(id: number) {
  await ensureCondicionesTables();
  await pool.query(`DELETE FROM gcc_world.gc_condiciones WHERE id = $1`, [id]);
}

// ── Variables / eventos / restricciones de una condición ──────────────────────
export async function addCondicionVariable(condicionId: number, v: { kind: 'fija' | 'catalogo'; variable_id?: number; nombre?: string; factor: string; causa?: string }) {
  await ensureCondicionesTables();
  let nombre = (v.nombre || '').trim();
  let factor = v.factor;
  let causa = v.causa || null;
  if (v.kind === 'catalogo') {
    if (!v.variable_id) throw new Error('Falta la variable del catálogo.');
    const { rows } = await pool.query(`SELECT factor, causa, nombre FROM gcc_world.dc_variables WHERE id = $1`, [v.variable_id]);
    if (!rows[0]) throw new Error('Variable de catálogo inexistente.');
    nombre = rows[0].nombre; factor = rows[0].factor; causa = rows[0].causa;
  }
  if (!nombre) throw new Error('El nombre de la variable es requerido.');
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gc_condicion_variables (condicion_id, kind, variable_id, nombre, factor, causa) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [condicionId, v.kind, v.kind === 'catalogo' ? v.variable_id : null, nombre, factor, causa],
  );
  return rows[0];
}
export async function deleteCondicionVariable(id: number) {
  await ensureCondicionesTables();
  await pool.query(`DELETE FROM gcc_world.gc_condicion_variables WHERE id = $1`, [id]);
}

export async function addCondicionEvento(condicionId: number, titulo: string, url: string) {
  await ensureCondicionesTables();
  const { rows } = await pool.query(`INSERT INTO gcc_world.gc_condicion_eventos (condicion_id, titulo, url) VALUES ($1, $2, $3) RETURNING *`, [condicionId, titulo.trim(), (url || '').trim()]);
  return rows[0];
}
export async function deleteCondicionEvento(id: number) {
  await ensureCondicionesTables();
  await pool.query(`DELETE FROM gcc_world.gc_condicion_eventos WHERE id = $1`, [id]);
}

export async function addCondicionRestriccion(condicionId: number, tipo: string, config: any) {
  await ensureCondicionesTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.gc_condicion_restricciones (condicion_id, tipo, config) VALUES ($1, $2, $3::jsonb) RETURNING *`,
    [condicionId, tipo, JSON.stringify(config || {})],
  );
  return rows[0];
}
export async function deleteCondicionRestriccion(id: number) {
  await ensureCondicionesTables();
  await pool.query(`DELETE FROM gcc_world.gc_condicion_restricciones WHERE id = $1`, [id]);
}

// ── Completar la tarea → materializar la pieza ────────────────────────────────
/** Al completar la tarea: vuelca las variables de todas las condiciones a
 *  gd_pieza_variables (con sus restricciones), marca la pieza 'completa' y la tarea 'completada'. */
export async function completeTask(taskId: number) {
  await ensureCondicionesTables();
  const { rows: mp } = await pool.query(`SELECT pieza_id FROM gcc_world.mc_task_pieza WHERE task_id = $1`, [taskId]);
  const piezaId = mp[0]?.pieza_id;
  if (!piezaId) throw new Error('La tarea no tiene pieza asociada.');

  const condiciones = await listCondiciones(piezaId);
  // Re-materializa las variables de la pieza desde las condiciones.
  await pool.query(`DELETE FROM gcc_world.gd_pieza_variables WHERE pieza_id = $1`, [piezaId]);
  for (const cond of condiciones) {
    // Objeto de restricciones (formato VariableRestricciones) de la condición.
    const restr: any = {};
    for (const r of cond.restricciones as any[]) {
      if (r.tipo === 'aplica_mas_de_uno') restr.aplicaMasDeUno = true;
      else if (r.tipo === 'no_junto_con') restr.variablesNoAceptadas = [...(restr.variablesNoAceptadas || []), ...((r.config?.variables) || [])];
      else if (r.tipo === 'solo_categorias') restr.soloCategorias = [...(restr.soloCategorias || []), ...((r.config?.categorias) || [])];
    }
    for (const v of cond.variables as any[]) {
      await pool.query(
        `INSERT INTO gcc_world.gd_pieza_variables (pieza_id, factor, nombre, tipo_var, restricciones) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [piezaId, v.factor, v.nombre, v.kind === 'fija' ? 'fija' : 'cambia', JSON.stringify(restr)],
      );
    }
  }
  await pool.query(`UPDATE gcc_world.gd_piezas SET estado = 'completa' WHERE id = $1`, [piezaId]);
  await pool.query(`UPDATE gcc_world.mc_tasks SET estado = 'completada' WHERE id = $1`, [taskId]);
  return { piezaId };
}

export async function reopenTask(taskId: number) {
  await ensureCondicionesTables();
  const { rows: mp } = await pool.query(`SELECT pieza_id FROM gcc_world.mc_task_pieza WHERE task_id = $1`, [taskId]);
  if (mp[0]?.pieza_id) await pool.query(`UPDATE gcc_world.gd_piezas SET estado = 'incompleta' WHERE id = $1`, [mp[0].pieza_id]);
  await pool.query(`UPDATE gcc_world.mc_tasks SET estado = 'pendiente' WHERE id = $1`, [taskId]);
}
