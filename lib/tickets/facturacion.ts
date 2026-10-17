import { pool } from '@/lib/db';

/**
 * ⇒ QUÉ REGISTROS DE TRABAJO ESTÁN FACTURADOS (Fernando, 2026-10-16).
 *
 * Cada registro (`ticket_actions`) guarda la factura que lo cubrió en `invoice_id`. Un registro
 * está FACTURADO si esa factura existe y no está anulada: anular la factura lo devuelve a
 * facturable sin tocar nada más, como ya pasa con las etapas del plan.
 *
 * La regla: AL FACTURAR UN TICKET ENTRAN TODOS LOS REGISTROS SIN FACTURAR — por «Completar y
 * facturar», por un cobro en línea (de todo lo pendiente o de UNA etapa: el cobro de una etapa
 * consume también todos los registros que existen en ese momento) y por una refactura. Un abono
 * no consume registros: es dinero a cuenta, no un trabajo concreto.
 *
 * Un registro con el reloj en marcha no entra: su costo aún no es el final.
 */

/** Condición SQL «el registro `a` no está facturado». */
export const REGISTRO_SIN_FACTURAR_SQL = (a = 'a') => `NOT EXISTS (
  SELECT 1 FROM gcc_world.invoices fi WHERE fi.id = ${a}.invoice_id AND fi.status <> 'cancelled'
)`;

type Consulta = { query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

/**
 * Ata a `invoiceId` los registros sin facturar del ticket. Con `ids`, solo esos (los que vio
 * quien facturó: uno añadido mientras tanto no se da por cobrado sin estar en la factura).
 * Devuelve cuántos marcó.
 */
export async function marcarRegistrosFacturados(
  ticketId: string | number,
  invoiceId: number,
  ids: number[] | null = null,
  db: Consulta = pool,
): Promise<number> {
  const params: any[] = [String(ticketId), invoiceId];
  let filtro = '';
  if (ids) {
    if (ids.length === 0) return 0;
    params.push(ids.map(Number).filter(Number.isFinite));
    filtro = ` AND a.id = ANY($3::int[])`;
  }
  const r = await db.query(
    `UPDATE gcc_world.ticket_actions a SET invoice_id = $2
      WHERE a.ticket_id = ($1)::int AND a.timer_started_at IS NULL
        AND ${REGISTRO_SIN_FACTURAR_SQL('a')}${filtro}`,
    params,
  );
  return r.rowCount ?? 0;
}

/** La factura vigente que cubre un registro, o null si está sin facturar. */
export async function facturaDelRegistro(actionId: number | string, db: Consulta = pool): Promise<string | null> {
  const { rows: [f] } = await db.query(
    `SELECT COALESCE(i.invoice_number, '#' || i.id) AS numero
       FROM gcc_world.ticket_actions a
       JOIN gcc_world.invoices i ON i.id = a.invoice_id AND i.status <> 'cancelled'
      WHERE a.id = $1`,
    [actionId],
  );
  return f?.numero ?? null;
}
