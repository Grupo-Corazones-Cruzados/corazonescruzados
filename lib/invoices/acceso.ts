import { pool } from '@/lib/db';
import { miembroDe } from '@/lib/projects/permisos';
import { sqlFacturaMia } from '@/lib/pertenencia';

/**
 * ¿Puede ver esta factura quien tiene esta sesión? Sale de la comprobación que hacía
 * `GET /api/invoices/[id]` (2026-11-09), para que sus ítems y su comprobante de pago pregunten lo
 * MISMO: antes respondían a cualquier sesión, con cualquier id.
 *
 *   · admin   — todas: es el dueño de la organización.
 *   · miembro — solo las de sus tickets y proyectos (Fernando, 2026-11-09: «ni las facturas de otros
 *               usuarios»), por todos los caminos de `sqlFacturaMia`. Una suscripción o una factura
 *               manual sin enlace no es de nadie más que del administrador.
 *   · candidato o cliente — solo si es SUYA: por `client_id`, o por un ticket o proyecto creado por él
 *               o de su cliente, o porque la emitió él con su cuenta de emisor (`member_id`, paso 4).
 *   Un miembro ve también las que emitió él (`invoices.member_id`, dentro de `sqlFacturaMia`).
 */
export async function puedeVerFactura(user: { userId: string | number; role: string }, id: string | number): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (!/^\d{1,18}$/.test(String(id))) return false;
  if (user.role === 'member') {
    const yo = await miembroDe(String(user.userId));
    const { rows } = await pool.query(
      `SELECT 1 FROM gcc_world.invoices i WHERE i.id = $1 AND ${sqlFacturaMia('i', '$2', '$3')} LIMIT 1`,
      [id, user.userId, yo],
    );
    return rows.length > 0;
  }
  const cr = await pool.query(`SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [user.userId]);
  const ownClientId = cr.rows[0]?.id != null ? Number(cr.rows[0].id) : -1;
  const owns = await pool.query(
    `SELECT 1 FROM gcc_world.invoices i
      WHERE i.id = $1 AND (
        i.client_id = $2
        OR i.ticket_id IN (SELECT id FROM gcc_world.tickets WHERE user_id = $3::uuid OR client_id = $2)
        OR i.project_id IN (SELECT id FROM gcc_world.projects WHERE created_by_user_id = $3::text OR client_id = $2)
        OR i.member_id = (SELECT member_id FROM gcc_world.users WHERE id = $3::uuid)
      ) LIMIT 1`,
    [id, ownClientId, user.userId],
  );
  return owns.rows.length > 0;
}
