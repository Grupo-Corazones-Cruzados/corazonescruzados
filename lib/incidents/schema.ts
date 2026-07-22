import { pool } from '@/lib/db';

/**
 * Sistema de INCIDENTES por proyecto (módulo de Proyectos, no DigiMundo).
 *
 * Tablas (raw SQL, esquema gcc_world) — reemplazan al viejo sistema Prisma
 * (Incident/Project/Module/Section/Subsection ligado a proyectos del DigiMundo):
 *  - project_incidents: un incidente ligado a un proyecto de la app (gcc_world.projects.id).
 *    La categoría/subcategoría se guarda por NOMBRE (snapshot) para que editar/borrar el
 *    catálogo no rompa incidentes históricos.
 *  - project_incident_categories / _subcategories: el catálogo (categorías → subcategorías)
 *    que el responsable define por proyecto y que el cliente elige al crear un incidente.
 *  - projects.incidents_token: token revocable (sin caducidad) para compartir el portal
 *    público de incidentes con un cliente externo.
 */
let ensuring: Promise<void> | null = null;
export function ensureIncidentTables(): Promise<void> {
  if (ensuring) return ensuring;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.project_incident_categories (
        id SERIAL PRIMARY KEY,
        project_id INT NOT NULL,
        name TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gcc_world.project_incident_subcategories (
        id SERIAL PRIMARY KEY,
        category_id INT NOT NULL REFERENCES gcc_world.project_incident_categories(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS gcc_world.project_incidents (
        id SERIAL PRIMARY KEY,
        project_id INT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        images TEXT[] NOT NULL DEFAULT '{}',
        category TEXT,
        subcategory TEXT,
        reporter_name TEXT,
        reporter_email TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS project_incidents_project_idx ON gcc_world.project_incidents(project_id);
      CREATE INDEX IF NOT EXISTS project_incident_categories_project_idx ON gcc_world.project_incident_categories(project_id);
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS incidents_token VARCHAR(64);
    `)
    .then(() => undefined)
    .catch((err: unknown) => { ensuring = null; throw err; });
  ensuring = p;
  return p;
}

export const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const INCIDENT_STATUSES = ['pending', 'reviewing', 'approved', 'completed', 'rejected'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica',
};
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', reviewing: 'En revisión', approved: 'Aprobado',
  completed: 'Completado', rejected: 'Rechazado',
};

export type ProjectForIncidents = {
  id: number;
  title: string;
  client_id: number | null;
  assigned_member_id: number | null;
  incidents_token: string | null;
};

/** Carga el proyecto (app) con lo necesario para gestionar sus incidentes. */
export async function loadProjectForIncidents(projectId: string): Promise<ProjectForIncidents | null> {
  await ensureIncidentTables();
  const { rows } = await pool.query(
    `SELECT id, title, client_id, assigned_member_id, incidents_token
       FROM gcc_world.projects WHERE id = $1`,
    [projectId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    title: r.title,
    client_id: r.client_id != null ? Number(r.client_id) : null,
    assigned_member_id: r.assigned_member_id != null ? Number(r.assigned_member_id) : null,
    incidents_token: r.incidents_token ?? null,
  };
}

/**
 * ¿Puede el usuario GESTIONAR incidentes del proyecto (definir categorías, compartir
 * token, cambiar estado, borrar)? = admin, o el miembro asignado, o el responsable
 * activo en project_members. Crear/ver está permitido a cualquier usuario autenticado.
 */
export async function canManageProjectIncidents(
  user: { userId: string; role: string },
  project: ProjectForIncidents,
): Promise<boolean> {
  if (user.role === 'admin') return true;
  const { rows } = await pool.query(
    `SELECT member_id FROM gcc_world.users WHERE id = $1 LIMIT 1`,
    [user.userId],
  );
  const memberId = rows[0]?.member_id != null ? Number(rows[0].member_id) : null;
  if (!memberId) return false;
  if (project.assigned_member_id === memberId) return true;
  const { rows: pm } = await pool.query(
    `SELECT 1 FROM gcc_world.project_members
      WHERE project_id = $1 AND member_id = $2 AND role = 'responsible' AND status = 'active' LIMIT 1`,
    [project.id, memberId],
  );
  return pm.length > 0;
}

/** Categorías del proyecto con sus subcategorías (para selectores y editor). */
export async function loadCategories(projectId: number): Promise<{ id: number; name: string; subcategories: { id: number; name: string }[] }[]> {
  const { rows: cats } = await pool.query(
    `SELECT id, name FROM gcc_world.project_incident_categories WHERE project_id = $1 ORDER BY sort_order, id`,
    [projectId],
  );
  if (cats.length === 0) return [];
  const { rows: subs } = await pool.query(
    `SELECT s.id, s.name, s.category_id
       FROM gcc_world.project_incident_subcategories s
       JOIN gcc_world.project_incident_categories c ON c.id = s.category_id
      WHERE c.project_id = $1 ORDER BY s.sort_order, s.id`,
    [projectId],
  );
  return cats.map((c: any) => ({
    id: Number(c.id),
    name: c.name,
    subcategories: subs.filter((s: any) => Number(s.category_id) === Number(c.id)).map((s: any) => ({ id: Number(s.id), name: s.name })),
  }));
}
