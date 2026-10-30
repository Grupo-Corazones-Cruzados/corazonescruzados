import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { regenerateRidePdf } from '@/lib/integrations/sri';
import { enlaceVeDetalle } from '@/lib/pagos/acceso';
import { TICKET_SQL_FACTURAS } from '@/lib/pagos/facturas-ticket';

/**
 * El RIDE de una factura del ticket, desde su enlace de pago. Gemelo de
 * `/api/projects/[id]/public/invoice`: se comprueba la llave (enlace de pago o token público del ticket) Y que la factura sea de ESTE ticket.
 *
 * GET /api/tickets/<id>/public/invoice?invoice_id=<n>&link=<enlace de pago> | &token=<token público>
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoiceId = req.nextUrl.searchParams.get('invoice_id');
    if (!invoiceId) return NextResponse.json({ error: 'Falta la factura' }, { status: 400 });
    const token = req.nextUrl.searchParams.get('token');
    const conToken = !!token && (await pool.query(
      `SELECT 1 FROM gcc_world.tickets
        WHERE id = ($1)::bigint AND public_token = $2
          AND (public_token_expires_at IS NULL OR public_token_expires_at > NOW())`,
      [id, token],
    )).rows.length > 0;
    if (!conToken && !(await enlaceVeDetalle(req.nextUrl.searchParams.get('link'), 'ticket', id))) {
      return NextResponse.json({ error: 'Este enlace ya no es válido' }, { status: 403 });
    }

    const { rows: [invoice] } = await pool.query(
      `SELECT x.id, x.invoice_number, inv.pdf_data, inv.authorization_number
         FROM (${TICKET_SQL_FACTURAS}) x
         JOIN gcc_world.invoices inv ON inv.id = x.id
        WHERE x.id = ($2)::int`,
      [String(id), invoiceId],
    );
    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    let buffer: Buffer | null = null;
    if (invoice.authorization_number) {
      try { buffer = await regenerateRidePdf(Number(invoice.id)); }
      catch (e: any) { console.error('RIDE público (ticket): re-render falló, uso la copia:', e.message); }
    }
    if (!buffer) buffer = invoice.pdf_data ? Buffer.from(invoice.pdf_data) : null;
    if (!buffer) return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Factura-${invoice.invoice_number}.pdf"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Public ticket invoice PDF error:', err.message);
    return NextResponse.json({ error: 'Error al obtener la factura' }, { status: 500 });
  }
}
