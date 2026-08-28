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
     *
     * ⚠️ Y NO BASTA CON `invoices.client_id`. Ese campo está vacío en buena parte de las
     * facturas: una emitida desde un ticket se enlaza por `source_type`/`source_id`, las
     * antiguas por las columnas `ticket_id`/`project_id`, y las de proyecto también por
     * la tabla `invoice_projects`. Mirando solo `client_id`, a Peter Tours su propia
     * factura del ticket #12 —autorizada y con PDF— le salía como «no encontrada».
     *
     * Así que la pertenencia se resuelve por TODOS los caminos por los que una factura
     * puede colgar de un cliente. Es una consulta y no cuatro `if`: cada camino que se
     * comprobara aparte sería uno que algún día se olvida.
     */
    if (user.role === 'client') {
      const { rows: [ficha] } = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [user.userId],
      );
      const suya = ficha && (await pool.query(
        `SELECT 1
           FROM gcc_world.invoices i
          WHERE i.id = $1
            AND (
              i.client_id = $2
              OR EXISTS (SELECT 1 FROM gcc_world.tickets t
                          WHERE t.client_id = $2
                            AND (t.id = i.ticket_id
                                 OR (i.source_type = 'ticket' AND i.source_id = t.id::text)))
              OR EXISTS (SELECT 1 FROM gcc_world.projects p
                          WHERE p.client_id = $2
                            AND (p.id = i.project_id
                                 OR (i.source_type = 'project' AND i.source_id = p.id::text)
                                 OR EXISTS (SELECT 1 FROM gcc_world.invoice_projects ip
                                             WHERE ip.invoice_id = i.id
                                               AND ip.project_id = p.id::text)))
            )
          LIMIT 1`,
        [id, ficha.id],
      )).rows.length > 0;

      // Se responde 404 y no 403: quien no tiene por qué saber que esa factura existe,
      // tampoco tiene por qué enterarse por el código de error.
      if (!suya) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
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
