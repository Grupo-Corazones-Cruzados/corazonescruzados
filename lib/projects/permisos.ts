/**
 * QUIÉN PUEDE TOCAR EL TRABAJO DE UN PROYECTO — requerimientos, subtareas y asignaciones.
 *
 * ⚠️ POR QUÉ EXISTE (2026-09-28). Las tres rutas que editan ese trabajo solo exigían tener
 * sesión: fuera de «en progreso», cualquiera —un cliente incluido— podía cambiar o borrar
 * requerimientos ajenos, crear y ACEPTAR asignaciones (que mueven lo que el proyecto le
 * paga a un miembro) y tocar subtareas. Tampoco se cruzaba el id con el proyecto de la URL.
 * Una sola definición para las tres, porque dos parecidas se separan al primer arreglo.
 *
 *   · gestor   — admin, o el creador/responsable del proyecto (`created_by_user_id`, o su
 *                ficha de miembro es `assigned_member_id`, que se sincroniza con el
 *                responsable). Es el mismo criterio que `isOwner` en la pantalla.
 *   · asignado — el miembro con asignación ACEPTADA en ese requerimiento.
 *
 * Ver [[gcc-hay-sesion-no-es-tuyo]].
 */
import { pool } from '@/lib/db';

type Usuario = { userId: string; role: string };

export async function miembroDe(userId: string): Promise<number | null> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  return u?.member_id != null ? Number(u.member_id) : null;
}

export async function esGestorDelProyecto(user: Usuario, projectId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const { rows: [p] } = await pool.query(
    `SELECT created_by_user_id, assigned_member_id FROM gcc_world.projects WHERE id = ($1)::bigint`,
    [projectId],
  );
  if (!p) return false;
  if (p.created_by_user_id && String(p.created_by_user_id) === String(user.userId)) return true;
  const yo = await miembroDe(user.userId);
  return yo != null && p.assigned_member_id != null && Number(p.assigned_member_id) === yo;
}

export async function esAsignadoAlRequerimiento(user: Usuario, requirementId: number | string): Promise<boolean> {
  const yo = await miembroDe(user.userId);
  if (yo == null) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.requirement_assignments
      WHERE requirement_id = ($1)::bigint AND member_id = $2 AND status = 'accepted' LIMIT 1`,
    [String(requirementId), yo],
  );
  return rows.length > 0;
}

export async function requerimientoDelProyecto(requirementId: unknown, projectId: string): Promise<boolean> {
  if (requirementId == null || requirementId === '') return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.project_requirements WHERE id = ($1)::bigint AND project_id = ($2)::bigint`,
    [String(requirementId), projectId],
  );
  return rows.length > 0;
}

/** Estados en los que el trabajo ya no se toca (lo que se cobra está cerrado). */
/**
 * ¿Puede subir, quitar y renombrar las FOTOS del proyecto? Admin, el creador (su ficha es
 * `assigned_member_id`) o un participante con puja ACEPTADA. Es la regla que tenía la galería
 * (`/api/projects/[id]/images`); vive aquí para que la usen también el renombrado de
 * `/api/media` y cualquier otra ruta que toque esas fotos (2026-10-13).
 */
export async function puedeGestionarImagenes(user: Usuario, projectId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const yo = await miembroDe(user.userId);
  if (yo == null) return false;
  const { rows: [p] } = await pool.query(`SELECT assigned_member_id FROM gcc_world.projects WHERE id = $1`, [projectId]);
  if (!p) return false;
  if (String(p.assigned_member_id) === String(yo)) return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.project_bids WHERE project_id = $1 AND member_id = $2 AND status = 'accepted' LIMIT 1`,
    [projectId, yo],
  );
  return rows.length > 0;
}

export const ESTADOS_CERRADOS = ['review', 'completed', 'cancelled', 'closed'];
