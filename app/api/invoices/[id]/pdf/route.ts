import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { regenerateRidePdf } from '@/lib/integrations/sri';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { rows: [invoice] } = await pool.query(
      `SELECT pdf_data, invoice_number, authorization_number, client_id
         FROM gcc_world.invoices WHERE id = $1`, [id]
    );
    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    /**
     * ⛔ ESTA RUTA NO MIRABA DE QUIÉN ERA LA FACTURA (arreglado 2026-08-28).
     *
     * Bastaba con tener sesión —valía un candidato del portal de empleo— y cambiar el
     * número de la URL para descargarse el comprobante de cualquiera: con su RUC, su
     * razón social, su dirección y lo que pagó. Se descubrió al enlazar aquí el botón
     * «Ver factura» del cliente, que antes iba a un módulo que él no puede abrir.
     *
     * Un CLIENTE solo ve las suyas. El equipo de GCC las ve todas: emitir y revisar
     * comprobantes es su trabajo.
     */
    if (user.role === 'client') {
      const { rows: [ficha] } = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [user.userId],
      );
      // Se responde 404 y no 403: quien no tiene por qué saber que esa factura existe,
      // tampoco tiene por qué enterarse por el código de error.
      if (!ficha || String(invoice.client_id ?? '') !== String(ficha.id)) {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
      }
    }

    // For authorized invoices, re-render the RIDE on the fly so every download uses
    // the current template (older invoices pick up layout fixes). Fall back to the
    // stored PDF if regeneration fails for any reason.
    let buffer: Buffer | null = null;
    if (invoice.authorization_number) {
      try {
        buffer = await regenerateRidePdf(Number(id));
      } catch (e: any) {
        console.error('PDF re-render failed, using stored copy:', e.message);
      }
    }
    if (!buffer) buffer = invoice.pdf_data ? Buffer.from(invoice.pdf_data) : null;
    if (!buffer) return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="RIDE-${invoice.invoice_number}.pdf"`,
        'Content-Length': String(buffer.length),
        // Always fetch a freshly re-rendered RIDE (never a cached old layout)
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
