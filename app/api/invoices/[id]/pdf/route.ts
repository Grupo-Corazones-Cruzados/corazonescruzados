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
      `SELECT pdf_data, invoice_number, authorization_number FROM gcc_world.invoices WHERE id = $1`, [id]
    );
    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

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
