import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { generateDetalleServiciosPdf } from '@/lib/documents/detalle-servicios';

/**
 * PDF del DETALLE DE SERVICIOS. Se arma al vuelo con los ítems reales de la factura más
 * los conceptos adicionales guardados: así el documento nunca se queda con una copia
 * vieja de la factura, y un arreglo de plantilla llega también a los ya creados.
 *
 * Es un documento interno que Fernando descarga y envía a mano, así que pide sesión de
 * administrador — a diferencia del RIDE, que el cliente sí puede descargar con su token.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const { rows: [invoice] } = await pool.query(
      `SELECT invoice_number, created_at, authorization_number,
              client_name_sri, client_ruc, client_address_sri, client_email_sri
         FROM gcc_world.invoices WHERE id = ($1)::int`, [id]
    );
    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    const { rows: [doc] } = await pool.query(
      `SELECT items, notes FROM gcc_world.invoice_annexes WHERE invoice_id = ($1)::int`, [id]
    );
    if (!doc) return NextResponse.json({ error: 'Esta factura no tiene detalle de servicios' }, { status: 404 });

    const { rows: items } = await pool.query(
      `SELECT description, quantity, unit_price, subtotal
         FROM gcc_world.invoice_items_sri WHERE invoice_id = ($1)::int ORDER BY id`, [id]
    );

    const pdf = await generateDetalleServiciosPdf({
      numeroFactura: invoice.invoice_number || `#${id}`,
      fechaEmision: new Date(invoice.created_at).toLocaleDateString('es-EC'),
      numeroAutorizacion: invoice.authorization_number,
      clienteNombre: invoice.client_name_sri || 'CONSUMIDOR FINAL',
      clienteRuc: invoice.client_ruc || '',
      clienteDireccion: invoice.client_address_sri || '',
      clienteEmail: invoice.client_email_sri || '',
      facturados: items.map((i: any) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        subtotal: Number(i.subtotal),
      })),
      adicionales: (doc.items || []).map((i: any) => ({
        description: i.description,
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unitPrice) || 0,
      })),
      notas: doc.notes || '',
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Detalle-${invoice.invoice_number || id}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Detalle de servicios PDF error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
