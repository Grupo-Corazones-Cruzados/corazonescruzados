import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getTicketBilling } from '@/lib/payments';
import { enlaceVeDetalle } from '@/lib/pagos/acceso';
import { TICKET_SQL_FACTURAS } from '@/lib/pagos/facturas-ticket';

/**
 * Lo que ve el CLIENTE del ticket desde su enlace de pago (Fernando, 2026-10-30), gemelo de
 * `/api/projects/[id]/public`.
 *
 * Un ticket se cobra por lo CONSUMIDO, así que aquí sí salen los registros de trabajo —fecha,
 * qué se hizo, tiempo e importe—: son la cuenta de lo que paga, lo mismo que ve el cliente con
 * cuenta en su panel. No salen las notas internas ni quién hizo cada registro.
 *
 * Dos llaves, cualquiera vale: el `token` público del ticket (el enlace que viaja en el correo
 * de la factura, desde c0065f1b) o el `link` de su enlace de pago.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const enlace = await enlaceVeDetalle(req.nextUrl.searchParams.get('link'), 'ticket', id);
    const token = req.nextUrl.searchParams.get('token');
    const conToken = !enlace && !!token && (await pool.query(
      `SELECT 1 FROM gcc_world.tickets
        WHERE id = ($1)::bigint AND public_token = $2
          AND (public_token_expires_at IS NULL OR public_token_expires_at > NOW())`,
      [id, token],
    )).rows.length > 0;
    if (!enlace && !conToken) {
      return NextResponse.json({ error: 'Este enlace ya no es válido. Pídele uno nuevo a tu contacto en GCC.' }, { status: 403 });
    }

    const { rows: [t] } = await pool.query(
      `SELECT t.id, t.title, t.description, t.status, t.deadline, t.completed_at, t.created_at,
              c.name AS client_name,
              (SELECT s.name FROM gcc_world.services s WHERE s.id = t.service_id) AS servicio
         FROM gcc_world.tickets t
         LEFT JOIN gcc_world.clients c ON c.id = t.client_id
        WHERE t.id = ($1)::bigint`,
      [id],
    );
    if (!t) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    const { rows: registros } = await pool.query(
      `SELECT id, COALESCE(work_date, created_at) AS fecha, description, duration_seconds, cost
         FROM gcc_world.ticket_actions
        WHERE ticket_id = ($1)::bigint
        ORDER BY COALESCE(work_date, created_at), id`,
      [id],
    );
    const billing = await getTicketBilling(id);
    const { rows: invoices } = await pool.query(`${TICKET_SQL_FACTURAS} ORDER BY i.created_at`, [String(id)]);

    return NextResponse.json({
      data: {
        ...t,
        registros: registros.map((r: any) => ({
          id: Number(r.id),
          fecha: r.fecha,
          descripcion: r.description,
          segundos: Number(r.duration_seconds) || 0,
          importe: Number(r.cost) || 0,
        })),
        etapas: (billing?.etapas || []).map((e) => ({
          id: e.id, name: e.name, amount: e.amount, facturada: !!e.invoiceId, invoiceNumber: e.invoiceNumber,
        })),
        invoices,
        pagable: enlace?.pagable ?? false,
      },
    });
  } catch (err: any) {
    console.error('Public ticket GET error:', err.message);
    return NextResponse.json({ error: 'Error al obtener el ticket' }, { status: 500 });
  }
}
