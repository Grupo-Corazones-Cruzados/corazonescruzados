import { pool } from '@/lib/db';

/**
 * ¿Puede ver esta factura quien tiene esta sesión? Sale de la comprobación que hacía
 * `GET /api/invoices/[id]` (2026-11-09), para que sus ítems y su comprobante de pago pregunten lo
 * MISMO: antes respondían a cualquier sesión, con cualquier id.
 *
 * El equipo (admin y miembro) la ve; un candidato o cliente, solo si es SUYA: por `client_id`, o
 * por un ticket o proyecto creado por él o de su cliente.
 */
export async function puedeVerFactura(user: { userId: string | number; role: string }, id: string | number): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'member') return true;
  const cr = await pool.query(`SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [user.userId]);
  const ownClientId = cr.rows[0]?.id != null ? Number(cr.rows[0].id) : -1;
  const owns = await pool.query(
    `SELECT 1 FROM gcc_world.invoices i
      WHERE i.id = $1 AND (
        i.client_id = $2
        OR i.ticket_id IN (SELECT id FROM gcc_world.tickets WHERE user_id = $3::uuid OR client_id = $2)
        OR i.project_id IN (SELECT id FROM gcc_world.projects WHERE created_by_user_id = $3::text OR client_id = $2)
      ) LIMIT 1`,
    [id, ownClientId, user.userId],
  );
  return owns.rows.length > 0;
}
