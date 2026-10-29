import { pool } from '@/lib/db';
import { getProjectBilling, getTicketBilling } from '@/lib/payments';

/**
 * PAGADO POR ENLACE ⇒ COMPLETADO (Fernando, 2026-10-29).
 *
 * Textual: *«cuando un cliente paga a través de un enlace de pago […] debería cambiar el estado
 * de este ticket a completado y no debería seguir en confirmado. Solo en el caso se anule esa
 * factura […] debería volver al estado confirmado o pendiente según corresponda»*.
 *
 * Se completa solo cuando el cobro deja el origen **sin nada por cobrar**: pagar una etapa de
 * tres no cierra el proyecto. El estado que tenía se guarda en la factura
 * (`origen_estado_previo`), y es el que le devuelve la anulación.
 *
 * ⚠️ El ingreso ya entró por la factura (`invoice`/<id>). Completar un ticket o un proyecto
 * hace que el relleno de `/api/finance` le sume su costo entero si su origen no está en el
 * registro, así que se apunta antes en `finance_source_log`: sin eso, el ticket #49 habría
 * contado 210 $ de la factura más 15 $ de su costo estimado.
 */
export async function completarOrigenCobrado(sourceType: string, sourceId: string, invoiceId: number): Promise<boolean> {
  const esTicket = sourceType === 'ticket';
  if (!esTicket && sourceType !== 'project') return false;

  const billing = esTicket ? await getTicketBilling(sourceId) : await getProjectBilling(sourceId);
  if (!billing || ['completed', 'cancelled', 'draft'].includes(billing.status)) return false;
  const queda = esTicket ? (billing as any).pending : (billing as any).billable;
  if (Number(queda) > 0) return false;

  const tabla = esTicket ? 'tickets' : 'projects';
  const { rowCount } = await pool.query(
    `UPDATE gcc_world.${tabla} SET status = 'completed', ${esTicket ? 'completed_at = NOW(), ' : ''}updated_at = NOW()
      WHERE id = ($1)::bigint AND status = $2`,
    [sourceId, billing.status],
  );
  if (!rowCount) return false;

  await pool.query(`UPDATE gcc_world.invoices SET origen_estado_previo = $1 WHERE id = $2`, [billing.status, invoiceId]);
  await pool.query(
    `INSERT INTO gcc_world.finance_source_log (source_type, source_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [sourceType, sourceId],
  );
  return true;
}
