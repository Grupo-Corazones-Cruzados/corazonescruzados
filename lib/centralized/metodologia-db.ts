// Capa de datos del sistema "Metodología Condiciológica" (global · fundamentación).
// Prefijo mc_. Proyectos de investigación + tareas generadas desde códigos verificados;
// al crear una tarea se pre-crea una PIEZA VACÍA (en Gestión de Datos) que se completará
// luego en Gestión de Condiciones.
import { pool } from '@/lib/db';
import { ensureGestionDatosTables, createEmptyPieza, listVerifiedCodigos } from '@/lib/centralized/gestion-datos-db';

let ready = false;

export async function ensureMetodologiaTables(): Promise<void> {
  if (ready) return;
  // gd_piezas debe existir antes de la FK de mc_task_pieza.
  await ensureGestionDatosTables();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.mc_research_projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.mc_tasks (
      id SERIAL PRIMARY KEY,
      research_project_id INT NOT NULL REFERENCES gcc_world.mc_research_projects(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      notas TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'pendiente',   -- 'pendiente' | 'completada'
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS mc_tasks_project_idx ON gcc_world.mc_tasks(research_project_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.mc_task_codigos (
      id SERIAL PRIMARY KEY,
      task_id INT NOT NULL REFERENCES gcc_world.mc_tasks(id) ON DELETE CASCADE,
      codigo_id INT NOT NULL REFERENCES gcc_world.gd_codigos(id) ON DELETE CASCADE,
      UNIQUE (task_id, codigo_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.mc_task_pieza (
      id SERIAL PRIMARY KEY,
      task_id INT NOT NULL REFERENCES gcc_world.mc_tasks(id) ON DELETE CASCADE,
      pieza_id INT NOT NULL REFERENCES gcc_world.gd_piezas(id) ON DELETE CASCADE,
      UNIQUE (task_id)
    )`);
  ready = true;
}

// ── Proyectos de investigación ────────────────────────────────────────────────
export async function listResearchProjects() {
  await ensureMetodologiaTables();
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.purpose, p.created_at,
            (SELECT COUNT(*) FROM gcc_world.mc_tasks t WHERE t.research_project_id = p.id)::int AS tasks_count
       FROM gcc_world.mc_research_projects p ORDER BY p.created_at ASC`,
  );
  return rows;
}

export async function createResearchProject(name: string, purpose?: string) {
  await ensureMetodologiaTables();
  if (!name?.trim()) throw new Error('El nombre es requerido.');
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.mc_research_projects (name, purpose) VALUES ($1, $2) RETURNING *`,
    [name.trim(), (purpose || '').trim()],
  );
  return rows[0];
}

export async function updateResearchProject(id: number, name?: string, purpose?: string) {
  await ensureMetodologiaTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (name != null) { sets.push(`name = $${params.length + 1}`); params.push(name.trim()); }
  if (purpose != null) { sets.push(`purpose = $${params.length + 1}`); params.push(purpose.trim()); }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.mc_research_projects SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}

export async function deleteResearchProject(id: number) {
  await ensureMetodologiaTables();
  await pool.query(`DELETE FROM gcc_world.mc_research_projects WHERE id = $1`, [id]);
}

// ── Códigos verificados (para la pestaña Reconocer) ───────────────────────────
export async function listReconocerCodigos() {
  await ensureMetodologiaTables();
  return listVerifiedCodigos();
}

// ── Tareas ────────────────────────────────────────────────────────────────────
export async function listTasks(researchProjectId: number) {
  await ensureMetodologiaTables();
  const { rows } = await pool.query(
    `SELECT id, titulo, notas, estado, created_at FROM gcc_world.mc_tasks
      WHERE research_project_id = $1 ORDER BY created_at ASC`,
    [researchProjectId],
  );
  const out = [];
  for (const t of rows) {
    const { rows: cods } = await pool.query(`SELECT codigo_id FROM gcc_world.mc_task_codigos WHERE task_id = $1`, [t.id]);
    const { rows: pz } = await pool.query(`SELECT pieza_id FROM gcc_world.mc_task_pieza WHERE task_id = $1`, [t.id]);
    out.push({ ...t, codigoIds: cods.map((c: any) => c.codigo_id), piezaId: pz[0]?.pieza_id ?? null });
  }
  return out;
}

/** Crea una tarea desde un conjunto de códigos verificados y PRE-CREA una pieza vacía
 *  (incompleta) en la problemática de esos códigos. La tarea va a Gestión de Condiciones. */
export async function createTask(researchProjectId: number, titulo: string, notas: string, codigoIds: number[]) {
  await ensureMetodologiaTables();
  if (!titulo?.trim()) throw new Error('El título de la tarea es requerido.');
  if (!codigoIds?.length) throw new Error('Selecciona al menos un código verificado.');

  // Valida que los códigos existan y estén verificados; toma la problemática del primero.
  const { rows: cods } = await pool.query(
    `SELECT id, problematica_id, verificado FROM gcc_world.gd_codigos WHERE id = ANY($1::int[])`,
    [codigoIds],
  );
  if (cods.length !== codigoIds.length) throw new Error('Algún código no existe.');
  if (cods.some((c: any) => !c.verificado)) throw new Error('Solo se pueden usar códigos verificados.');
  const problematicaId = Number(cods[0].problematica_id);

  const { rows } = await pool.query(
    `INSERT INTO gcc_world.mc_tasks (research_project_id, titulo, notas) VALUES ($1, $2, $3) RETURNING *`,
    [researchProjectId, titulo.trim(), (notas || '').trim()],
  );
  const task = rows[0];
  for (const cid of codigoIds) {
    await pool.query(`INSERT INTO gcc_world.mc_task_codigos (task_id, codigo_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [task.id, cid]);
  }
  // Pieza vacía (incompleta) para esta tarea.
  const pieza = await createEmptyPieza(problematicaId, 'revision');
  await pool.query(`INSERT INTO gcc_world.mc_task_pieza (task_id, pieza_id) VALUES ($1, $2) ON CONFLICT (task_id) DO NOTHING`, [task.id, pieza.id]);
  return { ...task, piezaId: pieza.id };
}

export async function updateTask(id: number, titulo?: string, notas?: string, estado?: string) {
  await ensureMetodologiaTables();
  const sets: string[] = [];
  const params: any[] = [];
  if (titulo != null) { sets.push(`titulo = $${params.length + 1}`); params.push(titulo.trim()); }
  if (notas != null) { sets.push(`notas = $${params.length + 1}`); params.push(notas.trim()); }
  if (estado != null) { sets.push(`estado = $${params.length + 1}`); params.push(estado); }
  if (!sets.length) return;
  params.push(id);
  await pool.query(`UPDATE gcc_world.mc_tasks SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
}

export async function deleteTask(id: number) {
  await ensureMetodologiaTables();
  // La pieza asociada se borra en cascada (FK ON DELETE CASCADE desde mc_task_pieza→gd_piezas? NO:
  // la FK es mc_task_pieza→gd_piezas, borrar la tarea NO borra la pieza). Borramos la pieza vacía.
  const { rows } = await pool.query(`SELECT pieza_id FROM gcc_world.mc_task_pieza WHERE task_id = $1`, [id]);
  await pool.query(`DELETE FROM gcc_world.mc_tasks WHERE id = $1`, [id]);
  if (rows[0]?.pieza_id) {
    // Solo elimina la pieza si sigue incompleta (no se empezó a trabajar en Gestión de Condiciones).
    await pool.query(`DELETE FROM gcc_world.gd_piezas WHERE id = $1 AND estado = 'incompleta'`, [rows[0].pieza_id]);
  }
}
