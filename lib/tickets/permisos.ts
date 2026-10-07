import { pool } from '@/lib/db';

/**
 * QUIÉN PUEDE VER, EDITAR Y BORRAR UN TICKET (2026-10-07).
 *
 * Hasta hoy `GET/PATCH/DELETE /api/tickets/[id]` solo pedían una sesión: cualquiera —un
 * cliente incluido— podía leer, cambiar o BORRAR cualquier ticket sabiendo su número (ver la
 * memoria «"Hay sesión" no es "es tuyo"»). La regla respeta cómo trabaja el equipo hoy (los
 * miembros ven y editan todos los tickets desde la lista) y cierra el resto:
 *
 *  VER    · admin · cualquier miembro · el miembro asignado (aunque sea candidato) · quien lo
 *           creó · el cliente del ticket (por su cuenta enlazada o por su correo) · quien tiene
 *           una propuesta en él · quien tiene perfil de miembro si el ticket está abierto a
 *           propuestas o por talento (para proponer o tomarlo).
 *  EDITAR · admin · miembros · el asignado. Marcarlo «completado» por aquí, solo el admin: es
 *           lo que registra el ingreso en finanzas.
 *  BORRAR · admin · quien creó un BORRADOR.
 *  Un BORRADOR, además, solo existe para quien lo creó y para el admin.
 */

type Usuario = { userId: string; role: string; email?: string };
export type TicketParaPermiso = {
  id: number | string; status: string; user_id: string | null; member_id: number | string | null;
  client_id: number | string | null; open_for_proposals?: boolean | null; open_for_talent?: boolean | null;
};

async function miMemberId(userId: string): Promise<number | null> {
  const { rows: [u] } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
  return u?.member_id != null ? Number(u.member_id) : null;
}

export async function puedeVerTicket(user: Usuario, t: TicketParaPermiso): Promise<boolean> {
  const esCreador = t.user_id != null && String(t.user_id) === user.userId;
  if (t.status === 'draft') return esCreador || user.role === 'admin';
  if (user.role === 'admin' || user.role === 'member' || esCreador) return true;
  const mid = await miMemberId(user.userId);
  if (mid != null && t.member_id != null && Number(t.member_id) === mid) return true;
  if (mid != null && (t.open_for_proposals || t.open_for_talent)) return true;
  if (t.client_id != null) {
    const { rows } = await pool.query(
      `SELECT 1 FROM gcc_world.clients c
        WHERE c.id = $1 AND (c.user_id = $2::uuid OR (c.email IS NOT NULL AND LOWER(c.email) = LOWER($3)))`,
      [t.client_id, user.userId, user.email || ''],
    );
    if (rows.length) return true;
  }
  if (mid != null) {
    const { rows } = await pool.query(
      `SELECT 1 FROM gcc_world.ticket_bids WHERE ticket_id = $1 AND member_id = $2 LIMIT 1`, [t.id, mid],
    ).catch(() => ({ rows: [] as any[] }));
    if (rows.length) return true;
  }
  return false;
}

export async function puedeEditarTicket(user: Usuario, t: TicketParaPermiso): Promise<boolean> {
  const esCreador = t.user_id != null && String(t.user_id) === user.userId;
  if (t.status === 'draft') return esCreador || user.role === 'admin';
  if (user.role === 'admin' || user.role === 'member') return true;
  const mid = await miMemberId(user.userId);
  return mid != null && t.member_id != null && Number(t.member_id) === mid;
}

export function puedeBorrarTicket(user: Usuario, t: TicketParaPermiso): boolean {
  if (user.role === 'admin') return true;
  return t.status === 'draft' && t.user_id != null && String(t.user_id) === user.userId;
}

export async function cargarTicketParaPermiso(id: string | number): Promise<TicketParaPermiso | null> {
  const { rows: [t] } = await pool.query(
    `SELECT id, status, user_id, member_id, client_id, open_for_proposals, open_for_talent
       FROM gcc_world.tickets WHERE id = $1`, [id],
  );
  return t ?? null;
}
