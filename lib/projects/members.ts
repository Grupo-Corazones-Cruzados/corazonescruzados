import { pool } from '@/lib/db';

/**
 * MIEMBROS DE UN PROYECTO — responsable + participantes (concepto pedido por el usuario).
 *
 * Modelo: una fila por (project_id, member_id) en `gcc_world.project_members` con:
 *  - `role`:   'responsible' | 'participant'
 *  - `status`: 'invited' | 'active'
 *
 * Reglas:
 *  - El RESPONSABLE toma el liderazgo del proyecto (mismos poderes que el creador). Se
 *    sincroniza con `projects.assigned_member_id` para no romper la lógica existente de
 *    "owner" (isMemberCreator) del detalle.
 *  - El responsable ES TAMBIÉN participante: la lógica de "participantes" incluye las
 *    filas con role='responsible' activas, sin necesidad de duplicar fila.
 *  - En "Solicitar proyecto" el responsable elegido entra como role='responsible',
 *    status='invited' (debe ACEPTAR el liderazgo). En "Nuevo proyecto" el creador entra
 *    directamente como role='responsible', status='active'.
 */
export async function ensureProjectMembersTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.project_members (
      id BIGSERIAL PRIMARY KEY,
      project_id BIGINT NOT NULL,
      member_id BIGINT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'participant',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (project_id, member_id)
    )
  `);
}

/** Fija (o invita a) un responsable. Un proyecto tiene UN responsable a la vez. */
export async function setResponsible(
  projectId: number | string,
  memberId: number | string,
  opts: { invited?: boolean } = {},
): Promise<void> {
  await ensureProjectMembersTable();
  const status = opts.invited ? 'invited' : 'active';
  // Un solo responsable: degrada cualquier otro responsable existente a participante activo.
  await pool.query(
    `UPDATE gcc_world.project_members SET role='participant', status='active', updated_at=now()
      WHERE project_id=$1 AND role='responsible' AND member_id<>$2`,
    [projectId, memberId],
  );
  await pool.query(
    `INSERT INTO gcc_world.project_members (project_id, member_id, role, status)
       VALUES ($1, $2, 'responsible', $3)
     ON CONFLICT (project_id, member_id)
       DO UPDATE SET role='responsible', status=$3, updated_at=now()`,
    [projectId, memberId, status],
  );
  // Si queda como responsable ACTIVO, es también el miembro asignado del proyecto.
  if (!opts.invited) {
    await pool.query(`UPDATE gcc_world.projects SET assigned_member_id=$1, updated_at=now() WHERE id=$2`, [memberId, projectId]);
  }
}

/** Agrega un participante (idempotente; no degrada a un responsable existente). */
export async function addParticipant(projectId: number | string, memberId: number | string): Promise<void> {
  await ensureProjectMembersTable();
  await pool.query(
    `INSERT INTO gcc_world.project_members (project_id, member_id, role, status)
       VALUES ($1, $2, 'participant', 'active')
     ON CONFLICT (project_id, member_id) DO NOTHING`,
    [projectId, memberId],
  );
}

/** Lista los miembros del proyecto (responsable + participantes) con datos del miembro. */
export async function getProjectMembers(projectId: number | string): Promise<any[]> {
  await ensureProjectMembersTable();
  const { rows } = await pool.query(
    `SELECT pm.member_id, pm.role, pm.status, m.name AS member_name, m.email AS member_email, m.photo_url
       FROM gcc_world.project_members pm
       JOIN gcc_world.members m ON m.id = pm.member_id
      WHERE pm.project_id = $1
      ORDER BY (pm.role='responsible') DESC, m.name`,
    [projectId],
  );
  return rows;
}
