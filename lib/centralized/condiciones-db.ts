// Capa de datos del sistema "Gestión de Condiciones" (controlador · fundamentación).
// Prefijos: dc_ (catálogo de variables de Dinámica Condiciológica) y gc_ (condiciones).
// Recibe tareas de Metodología (mc_tasks) y completa la pieza (gd_piezas) con las variables
// descubiertas + eventos de verificación + restricciones.
import { pool } from '@/lib/db';
import { ensureGestionDatosTables, getCodigoDetalle } from '@/lib/centralized/gestion-datos-db';
import { ensureMetodologiaTables } from '@/lib/centralized/metodologia-db';
import { gdKey, type GdGraph } from '@/lib/centralized/gestion-datos';
import { addParticipant, setResponsible } from '@/lib/projects/members';
import { ensureUserClientAccount } from '@/lib/tickets/clientAccount';

let ready = false;

export async function ensureCondicionesTables(): Promise<void> {
  if (ready) return;
  await ensureGestionDatosTables();  // gd_piezas / gd_pieza_variables / gd_codigos
  await ensureMetodologiaTables();   // mc_tasks / mc_task_codigos / mc_task_pieza

  // Catálogo de variables (lo gestiona el sistema Dinámica Condiciológica): factor→causa→variable.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.dc_variables (
      id SERIAL PRIMARY KEY,
      factor TEXT NOT NULL,          -- 'mental' | 'corporal' | 'ambiental'
      causa TEXT NOT NULL,
      nombre TEXT NOT NULL,
      herramienta_monitoreo TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`ALTER TABLE gcc_world.dc_variables ADD COLUMN IF NOT EXISTS herramienta_monitoreo TEXT NOT NULL DEFAULT ''`);

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

  // ── Subtareas (requerimientos) → tickets/proyectos reales de paso fundamentación ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gc_requerimientos (
      id SERIAL PRIMARY KEY,
      task_id INT NOT NULL REFERENCES gcc_world.mc_tasks(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gc_requerimientos_task_idx ON gcc_world.gc_requerimientos(task_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gc_requerimiento_tickets (
      id SERIAL PRIMARY KEY,
      requerimiento_id INT NOT NULL REFERENCES gcc_world.gc_requerimientos(id) ON DELETE CASCADE,
      ticket_id INT NOT NULL,
      UNIQUE (requerimiento_id, ticket_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.gc_requerimiento_projects (
      id SERIAL PRIMARY KEY,
      requerimiento_id INT NOT NULL REFERENCES gcc_world.gc_requerimientos(id) ON DELETE CASCADE,
      project_id INT NOT NULL,
      UNIQUE (requerimiento_id, project_id)
    )`);
  // Marca de origen en tickets/proyectos: 'condiciones' + paso al que se restringe la toma.
  await pool.query(`ALTER TABLE gcc_world.tickets  ADD COLUMN IF NOT EXISTS source_system TEXT`);
  await pool.query(`ALTER TABLE gcc_world.tickets  ADD COLUMN IF NOT EXISTS source_paso   TEXT`);
  await pool.query(`ALTER TABLE gcc_world.tickets  ADD COLUMN IF NOT EXISTS open_for_proposals BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS source_system TEXT`);
  await pool.query(`ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS source_paso   TEXT`);

  ready = true;
}

// ── Miembros de paso fundamentación (posibles tomadores) ──────────────────────
export async function listMembersFundamentacion() {
  await ensureCondicionesTables();
  const { rows } = await pool.query(
    `SELECT id, name FROM gcc_world.members WHERE paso = 'fundamentacion' AND COALESCE(is_active, true) = true ORDER BY name ASC`,
  );
  return rows;
}

async function currentMemberPaso(userId: string): Promise<{ member_id: number | null; paso: string | null }> {
  const { rows } = await pool.query(
    `SELECT m.id AS member_id, m.paso FROM gcc_world.users u JOIN gcc_world.members m ON m.id = u.member_id WHERE u.id = $1`,
    [userId],
  );
  return { member_id: rows[0]?.member_id ?? null, paso: rows[0]?.paso ?? null };
}

// ── Requerimientos (subtareas) ────────────────────────────────────────────────
export async function listRequerimientos(taskId: number) {
  await ensureCondicionesTables();
  const { rows } = await pool.query(
    `SELECT id, titulo, descripcion, created_at FROM gcc_world.gc_requerimientos WHERE task_id = $1 ORDER BY created_at ASC`,
    [taskId],
  );
  const out = [];
  for (const r of rows) {
    const { rows: tks } = await pool.query(
      `SELECT t.id, t.title, t.status, t.member_id, t.open_for_proposals, m.name AS member_name
         FROM gcc_world.gc_requerimiento_tickets rt
         JOIN gcc_world.tickets t ON t.id = rt.ticket_id
         LEFT JOIN gcc_world.members m ON m.id = t.member_id
        WHERE rt.requerimiento_id = $1 ORDER BY rt.id ASC`, [r.id]);
    const { rows: prs } = await pool.query(
      `SELECT p.id, p.title, p.status, p.is_private, p.assigned_member_id, m.name AS member_name
         FROM gcc_world.gc_requerimiento_projects rp
         JOIN gcc_world.projects p ON p.id = rp.project_id
         LEFT JOIN gcc_world.members m ON m.id = p.assigned_member_id
        WHERE rp.requerimiento_id = $1 ORDER BY rp.id ASC`, [r.id]);
    out.push({ ...r, tickets: tks, projects: prs });
  }
  return out;
}

export async function createRequerimiento(taskId: number, titulo: string, descripcion?: string) {
  await ensureCondicionesTables();
  if (!titulo?.trim()) throw new Error('El título del requerimiento es requerido.');
  const { rows } = await pool.query(`INSERT INTO gcc_world.gc_requerimientos (task_id, titulo, descripcion) VALUES ($1, $2, $3) RETURNING *`, [taskId, titulo.trim(), (descripcion || '').trim()]);
  return rows[0];
}
export async function deleteRequerimiento(id: number) {
  await ensureCondicionesTables();
  await pool.query(`DELETE FROM gcc_world.gc_requerimientos WHERE id = $1`, [id]);
}

/** Enlaza un ticket/proyecto YA CREADO (por los endpoints reales) al requerimiento y lo
 *  marca como origen 'condiciones · fundamentación'. */
export async function linkEntregable(requerimientoId: number, kind: 'ticket' | 'project', refId: number) {
  await ensureCondicionesTables();
  if (kind === 'ticket') {
    await pool.query(`UPDATE gcc_world.tickets SET source_system = 'condiciones', source_paso = 'fundamentacion' WHERE id = $1`, [refId]);
    await pool.query(`INSERT INTO gcc_world.gc_requerimiento_tickets (requerimiento_id, ticket_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [requerimientoId, refId]);
  } else {
    await pool.query(`UPDATE gcc_world.projects SET source_system = 'condiciones', source_paso = 'fundamentacion' WHERE id = $1`, [refId]);
    await pool.query(`INSERT INTO gcc_world.gc_requerimiento_projects (requerimiento_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [requerimientoId, refId]);
  }
}

export async function unlinkEntregable(kind: 'ticket' | 'project', refId: number) {
  await ensureCondicionesTables();
  if (kind === 'ticket') await pool.query(`DELETE FROM gcc_world.gc_requerimiento_tickets WHERE ticket_id = $1`, [refId]);
  else await pool.query(`DELETE FROM gcc_world.gc_requerimiento_projects WHERE project_id = $1`, [refId]);
}

/** Crea un TICKET real (usuario=cliente) bajo un requerimiento, marcado origen condiciones.
 *  assigned=miembro fundamentación asignado; si no, público (open_for_proposals). */
export async function createReqTicket(userId: string, requerimientoId: number, titulo: string, descripcion: string, memberId: number | null) {
  await ensureCondicionesTables();
  if (!titulo?.trim()) throw new Error('El título del ticket es requerido.');
  const clientId = await ensureUserClientAccount(userId);
  const open = !memberId;
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.tickets (title, description, service_id, member_id, client_id, user_id, open_for_proposals, status, source_system, source_paso, created_at, updated_at)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, 'pending', 'condiciones', 'fundamentacion', NOW(), NOW()) RETURNING id`,
    [titulo.trim(), (descripcion || '').trim(), memberId, clientId, userId, open],
  );
  const ticketId = rows[0].id;
  await pool.query(`INSERT INTO gcc_world.gc_requerimiento_tickets (requerimiento_id, ticket_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [requerimientoId, ticketId]);
  return { id: ticketId };
}

/** Crea un PROYECTO real (usuario=cliente) bajo un requerimiento, marcado origen condiciones. */
export async function createReqProject(userId: string, requerimientoId: number, titulo: string, descripcion: string, memberId: number | null) {
  await ensureCondicionesTables();
  if (!titulo?.trim()) throw new Error('El título del proyecto es requerido.');
  const clientId = await ensureUserClientAccount(userId);
  const isPrivate = !!memberId; // asignado → privado; público → abierto
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.projects (title, description, status, is_private, client_id, created_by_user_id, source_system, source_paso, created_at, updated_at)
     VALUES ($1, $2, 'open', $3, $4, $5, 'condiciones', 'fundamentacion', NOW(), NOW()) RETURNING id`,
    [titulo.trim(), (descripcion || '').trim(), isPrivate, clientId, String(userId)],
  );
  const projectId = rows[0].id;
  if (memberId) await setResponsible(projectId, memberId, { invited: true });
  await pool.query(`INSERT INTO gcc_world.gc_requerimiento_projects (requerimiento_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [requerimientoId, projectId]);
  return { id: projectId };
}

// ── Tomar (solo miembros paso fundamentación) ─────────────────────────────────
export async function takeTicket(userId: string, ticketId: number) {
  await ensureCondicionesTables();
  const me = await currentMemberPaso(userId);
  if (!me.member_id || me.paso !== 'fundamentacion') throw new Error('Solo miembros de paso fundamentación pueden tomar este ticket.');
  const { rows } = await pool.query(`SELECT member_id, source_system FROM gcc_world.tickets WHERE id = $1`, [ticketId]);
  const t = rows[0];
  if (!t) throw new Error('Ticket inexistente.');
  if (t.member_id) throw new Error('Este ticket ya fue tomado.');
  await pool.query(`UPDATE gcc_world.tickets SET member_id = $1, open_for_proposals = false, updated_at = NOW() WHERE id = $2`, [me.member_id, ticketId]);
  return { member_id: me.member_id };
}

export async function joinProject(userId: string, projectId: number) {
  await ensureCondicionesTables();
  const me = await currentMemberPaso(userId);
  if (!me.member_id || me.paso !== 'fundamentacion') throw new Error('Solo miembros de paso fundamentación pueden participar en este proyecto.');
  await addParticipant(projectId, me.member_id);
  return { member_id: me.member_id };
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
  const { rows } = await pool.query(`SELECT id, factor, causa, nombre, herramienta_monitoreo FROM gcc_world.dc_variables ORDER BY factor ASC, causa ASC, nombre ASC`);
  return rows;
}
export async function createVariableCatalogo(factor: string, causa: string, nombre: string, herramientaMonitoreo?: string) {
  await ensureCondicionesTables();
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.dc_variables (factor, causa, nombre, herramienta_monitoreo) VALUES ($1, $2, $3, $4) RETURNING *`,
    [factor, causa, nombre.trim(), (herramientaMonitoreo || '').trim()],
  );
  return rows[0];
}
export async function updateVariableCatalogo(id: number, nombre?: string, herramientaMonitoreo?: string) {
  await ensureCondicionesTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (nombre != null) { sets.push(`nombre = $${params.length + 1}`); params.push(nombre.trim()); }
  if (herramientaMonitoreo != null) { sets.push(`herramienta_monitoreo = $${params.length + 1}`); params.push(herramientaMonitoreo.trim()); }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.dc_variables SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
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

// ── Universo de gráficos del workspace de la pieza ────────────────────────────
// Reusa los mismos iconos de Gestión de Datos: código (hexágono), pieza (pentágono),
// + condición (anillo) y variable (punto). Estructura: código→pieza→condición→variable.
export async function getPiezaGraph(piezaId: number): Promise<GdGraph> {
  await ensureCondicionesTables();
  const { rows: pz } = await pool.query(`SELECT id, tipo, estado FROM gcc_world.gd_piezas WHERE id = $1`, [piezaId]);
  const pieza = pz[0];
  if (!pieza) return { nodes: [], edges: [] };
  const nodes: GdGraph['nodes'] = [];
  const edges: GdGraph['edges'] = [];

  nodes.push({
    key: gdKey('pieza', pieza.id), type: 'pieza', id: pieza.id,
    title: pieza.tipo === 'correccion' ? 'Pieza · Corrección' : 'Pieza · Revisión',
    incompleta: pieza.estado !== 'completa',
  });

  const { rows: pcods } = await pool.query(`SELECT codigo_id FROM gcc_world.gd_pieza_codigos WHERE pieza_id = $1`, [piezaId]);
  for (const pc of pcods) {
    const d = await getCodigoDetalle(pc.codigo_id);
    if (d) {
      nodes.push({ key: gdKey('codigo', d.id), type: 'codigo', id: d.id, title: d.nomenclatura, verificado: d.verificado });
      edges.push({ source: gdKey('codigo', d.id), target: gdKey('pieza', pieza.id), kind: 'compone' });
    }
  }

  const conds = await listCondiciones(piezaId);
  for (const cond of conds as any[]) {
    nodes.push({ key: gdKey('condicion', cond.id), type: 'condicion', id: cond.id, title: cond.nombre, verificado: cond.verificada });
    edges.push({ source: gdKey('pieza', pieza.id), target: gdKey('condicion', cond.id), kind: 'agrupa' });
    for (const v of cond.variables as any[]) {
      nodes.push({ key: gdKey('variable', v.id), type: 'variable', id: v.id, title: v.nombre, subtitle: `${v.factor}${v.causa ? '/' + v.causa : ''}` });
      edges.push({ source: gdKey('condicion', cond.id), target: gdKey('variable', v.id), kind: 'compone' });
    }
  }
  return { nodes, edges };
}

export async function reopenTask(taskId: number) {
  await ensureCondicionesTables();
  const { rows: mp } = await pool.query(`SELECT pieza_id FROM gcc_world.mc_task_pieza WHERE task_id = $1`, [taskId]);
  if (mp[0]?.pieza_id) await pool.query(`UPDATE gcc_world.gd_piezas SET estado = 'incompleta' WHERE id = $1`, [mp[0].pieza_id]);
  await pool.query(`UPDATE gcc_world.mc_tasks SET estado = 'pendiente' WHERE id = $1`, [taskId]);
}
