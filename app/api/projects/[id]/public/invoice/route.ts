import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { regenerateRidePdf } from '@/lib/integrations/sri';

/**
 * Descarga del RIDE para el CLIENTE, desde el enlace público del proyecto.
 *
 * `/api/invoices/[id]/pdf` exige sesión y el cliente no la tiene: entra con el token del
 * proyecto. Por eso aquí se comprueban las dos cosas —el token del proyecto y que la
 * factura sea REALMENTE de ese proyecto— antes de servir nada.
 *
 * GET /api/projects/<id>/public/invoice?invoice_id=<n>&token=<t>
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');
    const invoiceId = req.nextUrl.searchParams.get('invoice_id');
    if (!invoiceId) return NextResponse.json({ error: 'Falta la factura' }, { status: 400 });

    const { rows: [project] } = await pool.query(
      `SELECT is_private, public_token, public_token_expires_at FROM gcc_world.projects WHERE id = ($1)::bigint`,
      [id]
    );
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    if (project.is_private) {
      if (!token || token !== project.public_token) {
        return NextResponse.json({ error: 'Este proyecto es privado' }, { status: 403 });
      }
      if (project.public_token_expires_at && new Date(project.public_token_expires_at) < new Date()) {
        return NextResponse.json({ error: 'El enlace ha expirado' }, { status: 403 });
      }
    }

    // La factura tiene que colgar de ESTE proyecto por alguno de sus tres enlaces.
    const { rows: [invoice] } = await pool.query(
      `SELECT i.id, i.invoice_number, i.pdf_data, i.authorization_number
         FROM gcc_world.invoices i
        WHERE i.id = ($1)::int AND i.status <> 'cancelled'
          AND (i.project_id = ($2)::bigint
               OR i.id IN (SELECT ip.invoice_id FROM gcc_world.invoice_projects ip WHERE ip.project_id = ($2)::text)
               OR i.id IN (SELECT e.invoice_id FROM gcc_world.project_stages e WHERE e.project_id = ($2)::bigint))`,
      [invoiceId, String(id)]
    );
    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    // Se re-renderiza al vuelo, como en el panel, para que el cliente siempre reciba el
    // RIDE con la plantilla vigente; si algo falla, sirve la copia guardada.
    let buffer: Buffer | null = null;
    if (invoice.authorization_number) {
      try { buffer = await regenerateRidePdf(Number(invoice.id)); }
      catch (e: any) { console.error('RIDE público: re-render falló, uso la copia:', e.message); }
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
    console.error('Public invoice PDF error:', err.message);
    return NextResponse.json({ error: 'Error al obtener la factura' }, { status: 500 });
  }
}
