import { pool } from '@/lib/db';

/** Un reloj en marcha, tal como lo enseña el teléfono (notificación / Actividad en Vivo). */
export type RelojEnMarcha = {
  registroId: number;
  ticketId: number;
  titulo: string;
  registro: string;
  cliente: string | null;
  tarifa: number;
  /** Desde cuándo cuenta: `timer_started_at` MENOS lo ya acumulado (ISO). */
  inicio: string;
};

/**
 * Los relojes en marcha de los tickets de un miembro (Fernando, 2026-10-06). Una sola consulta
 * para la ruta que pide el teléfono (`/api/tickets/relojes`) y para las push que arrancan el
 * reloj en el iPhone: los dos tienen que enseñar exactamente lo mismo.
 *
 * `inicio` resta lo acumulado: si no, al reanudar un registro el teléfono empezaría en cero
 * mientras la web dice 1:20:00.
 */
export async function relojesDelMiembro(memberId: number, registroId?: number): Promise<RelojEnMarcha[]> {
  const { rows } = await pool.query(
    `SELECT a.id AS registro_id, a.ticket_id, a.description, a.timer_started_at,
            COALESCE(a.duration_seconds, 0) AS duration_seconds,
            t.title AS ticket_titulo, c.name AS cliente,
            COALESCE(s.base_price, 0) AS tarifa
       FROM gcc_world.tickets t
       JOIN gcc_world.ticket_actions a ON a.ticket_id = t.id AND a.timer_started_at IS NOT NULL
       LEFT JOIN gcc_world.clients c   ON c.id = t.client_id
       LEFT JOIN gcc_world.services s  ON s.id = t.service_id
      WHERE t.member_id = $1
        AND t.status NOT IN ('completed', 'cancelled')
        AND ($2::bigint IS NULL OR a.id = $2)
      ORDER BY a.timer_started_at`,
    [memberId, registroId ?? null],
  );
  return rows.map((r: any) => ({
    registroId: Number(r.registro_id),
    ticketId: Number(r.ticket_id),
    titulo: r.ticket_titulo || `Ticket #${r.ticket_id}`,
    registro: r.description,
    cliente: r.cliente || null,
    tarifa: Number(r.tarifa) || 0,
    inicio: new Date(new Date(r.timer_started_at).getTime() - Number(r.duration_seconds) * 1000).toISOString(),
  }));
}
