import { pool } from '@/lib/db';

/**
 * Quién participa en cada chat PRIVADO de ticket / proyecto / experiencia, y qué chats tiene
 * abiertos un usuario. Es la pieza de SEGURIDAD del chat personal: la autorización se calcula
 * aquí en cada petición (no hay tabla de miembros de conversación), así que si alguien deja de
 * participar, deja de tener acceso de inmediato.
 *
 * Todo se normaliza a `users.id` **como texto**: `tickets.user_id` es uuid,
 * `projects.created_by_user_id` es TEXT y `ch_messages.user_id` es TEXT. Sin castear, los
 * comparadores fallarían o —peor— no cruzarían.
 *
 * ESTADOS "no completado" (de la propia app, no inventados):
 *  - Tickets  : pending | confirmed | in_progress            (`/api/admin/stats`)
 *  - Proyectos: draft | open | in_progress | review | in_review
 *               ⚠️ `review` e `in_review` son el MISMO estado escrito de dos formas en el
 *               código (la API graba `review`, parte de la UI usa `in_review`); ambos pueden
 *               existir en los datos, así que se contemplan los dos.
 *  - Eventos  : published | active  (los `draft` aún no tienen participantes)
 *
 * LÍMITE CONOCIDO: un cliente dado de alta solo por email (`clients.user_id IS NULL`) no tiene
 * cuenta y por tanto no puede entrar al chat. No es un fallo del chat: no hay a quién dar acceso.
 */

export type ScopeKind = 'ticket' | 'project' | 'experience';

export const ACTIVE_TICKET_STATUSES = ['pending', 'confirmed', 'in_progress'];
export const ACTIVE_PROJECT_STATUSES = ['draft', 'open', 'in_progress', 'review', 'in_review'];
export const ACTIVE_EVENT_STATUSES = ['published', 'active'];

export interface ScopeChat {
  kind: ScopeKind;
  refId: string;
  title: string;
  /** Estado del origen, para mostrarlo en la lista. */
  status: string;
}

/* ── Participantes por origen ────────────────────────────────────────────────── */

/** `users.id`(texto) → papel dentro de este chat, para poder etiquetarlo en la lista. */
export async function participantsOf(kind: ScopeKind, refId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const add = (rows: any[], relation: string) => {
    for (const r of rows) if (r.user_id) out[String(r.user_id)] = out[String(r.user_id)] || relation;
  };

  if (kind === 'ticket') {
    const id = Number(refId);
    if (!Number.isFinite(id)) return out;
    // El orden importa: la primera relación que se asigna es la que se muestra.
    add((await pool.query(
      `SELECT c.user_id::text AS user_id FROM gcc_world.tickets t
         JOIN gcc_world.clients c ON c.id = t.client_id
        WHERE t.id = $1 AND c.user_id IS NOT NULL`, [id])).rows, 'Cliente');
    add((await pool.query(
      `SELECT u.id::text AS user_id FROM gcc_world.tickets t
         JOIN gcc_world.users u ON u.member_id = t.member_id
        WHERE t.id = $1 AND t.member_id IS NOT NULL`, [id])).rows, 'Responsable');
    add((await pool.query(
      `SELECT t.user_id::text AS user_id FROM gcc_world.tickets t
        WHERE t.id = $1 AND t.user_id IS NOT NULL`, [id])).rows, 'Creador');
    return out;
  }

  if (kind === 'project') {
    const id = Number(refId);
    if (!Number.isFinite(id)) return out;
    add((await pool.query(
      `SELECT c.user_id::text AS user_id FROM gcc_world.projects p
         JOIN gcc_world.clients c ON c.id = p.client_id
        WHERE p.id = $1 AND c.user_id IS NOT NULL`, [id])).rows, 'Cliente');
    add((await pool.query(
      `SELECT u.id::text AS user_id FROM gcc_world.project_members pm
         JOIN gcc_world.users u ON u.member_id = pm.member_id
        WHERE pm.project_id = $1 AND pm.role = 'responsible'`, [id])).rows, 'Responsable');
    add((await pool.query(
      `SELECT u.id::text AS user_id FROM gcc_world.projects p
         JOIN gcc_world.users u ON u.member_id = p.assigned_member_id
        WHERE p.id = $1 AND p.assigned_member_id IS NOT NULL`, [id])).rows, 'Responsable');
    add((await pool.query(
      `SELECT u.id::text AS user_id FROM gcc_world.project_members pm
         JOIN gcc_world.users u ON u.member_id = pm.member_id
        WHERE pm.project_id = $1 AND pm.status = 'active'`, [id])).rows, 'Participante');
    add((await pool.query(
      `SELECT u.id::text AS user_id FROM gcc_world.project_bids pb
         JOIN gcc_world.users u ON u.member_id = pb.member_id
        WHERE pb.project_id = $1 AND pb.status = 'accepted'`, [id])).rows, 'Participante');
    add((await pool.query(
      `SELECT p.created_by_user_id::text AS user_id FROM gcc_world.projects p
        WHERE p.id = $1 AND p.created_by_user_id IS NOT NULL`, [id])).rows, 'Creador');
    return out;
  }

  // experience: creador del evento + quienes tomaron una tarea.
  const id = Number(refId);
  if (!Number.isFinite(id)) return out;
  add((await pool.query(
    `SELECT e.created_by::text AS user_id FROM gcc_world.gs_events e
      WHERE e.id = $1 AND e.created_by IS NOT NULL`, [id])).rows, 'Organizador');
  // Miembro: members.id → users.member_id. Candidato: clients.id → clients.user_id.
  add((await pool.query(
    `SELECT u.id::text AS user_id FROM gcc_world.gs_task_signups s
       JOIN gcc_world.users u ON u.member_id::text = s.subject_id
      WHERE s.event_id = $1 AND s.subject_kind = 'member'
     UNION
     SELECT c.user_id::text FROM gcc_world.gs_task_signups s
       JOIN gcc_world.clients c ON c.id::text = s.subject_id
      WHERE s.event_id = $1 AND s.subject_kind = 'candidate' AND c.user_id IS NOT NULL`, [id])).rows, 'Participante');
  return out;
}

/** ¿Este usuario participa en ese origen? Autorización real del chat. */
export async function canAccessScope(userId: string, kind: ScopeKind, refId: string): Promise<boolean> {
  const parts = await participantsOf(kind, refId);
  return !!parts[String(userId)];
}

/* ── Chats abiertos de un usuario ────────────────────────────────────────────── */

/**
 * Orígenes NO completados en los que el usuario participa. Uno por ticket, proyecto y evento:
 * son exactamente los chats que debe ver en su panel.
 */
export async function openScopesFor(userId: string): Promise<ScopeChat[]> {
  const out: ScopeChat[] = [];

  const { rows: tickets } = await pool.query(
    `SELECT DISTINCT t.id::text AS ref_id, t.title, t.status
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.clients c ON c.id = t.client_id
       LEFT JOIN gcc_world.users um ON um.member_id = t.member_id
      WHERE t.status = ANY($2::text[])
        AND ($1 = t.user_id::text OR $1 = c.user_id::text OR $1 = um.id::text)
      ORDER BY t.id DESC`,
    [userId, ACTIVE_TICKET_STATUSES],
  );
  for (const r of tickets) out.push({ kind: 'ticket', refId: r.ref_id, title: r.title || `Ticket #${r.ref_id}`, status: r.status });

  const { rows: projects } = await pool.query(
    `SELECT DISTINCT p.id::text AS ref_id, p.title, p.status
       FROM gcc_world.projects p
       LEFT JOIN gcc_world.clients c ON c.id = p.client_id
       LEFT JOIN gcc_world.users ua ON ua.member_id = p.assigned_member_id
       LEFT JOIN gcc_world.project_members pm ON pm.project_id = p.id
       LEFT JOIN gcc_world.users upm ON upm.member_id = pm.member_id
       LEFT JOIN gcc_world.project_bids pb ON pb.project_id = p.id AND pb.status = 'accepted'
       LEFT JOIN gcc_world.users upb ON upb.member_id = pb.member_id
      WHERE p.status = ANY($2::text[])
        AND ($1 = p.created_by_user_id::text OR $1 = c.user_id::text OR $1 = ua.id::text
             OR ($1 = upm.id::text AND (pm.status = 'active' OR pm.role = 'responsible'))
             OR $1 = upb.id::text)
      ORDER BY p.id DESC`,
    [userId, ACTIVE_PROJECT_STATUSES],
  );
  for (const r of projects) out.push({ kind: 'project', refId: r.ref_id, title: r.title || `Proyecto #${r.ref_id}`, status: r.status });

  const { rows: events } = await pool.query(
    `SELECT DISTINCT e.id::text AS ref_id, e.name AS title, e.status
       FROM gcc_world.gs_events e
       LEFT JOIN gcc_world.gs_task_signups s ON s.event_id = e.id
       LEFT JOIN gcc_world.users um ON s.subject_kind = 'member' AND um.member_id::text = s.subject_id
       LEFT JOIN gcc_world.clients cc ON s.subject_kind = 'candidate' AND cc.id::text = s.subject_id
      WHERE e.status = ANY($2::text[])
        AND ($1 = e.created_by::text OR $1 = um.id::text OR $1 = cc.user_id::text)
      ORDER BY e.id DESC`,
    [userId, ACTIVE_EVENT_STATUSES],
  );
  for (const r of events) out.push({ kind: 'experience', refId: r.ref_id, title: r.title || `Evento #${r.ref_id}`, status: r.status });

  return out;
}
