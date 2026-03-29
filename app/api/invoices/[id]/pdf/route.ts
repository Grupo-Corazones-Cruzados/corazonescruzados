import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { rows: [invoice] } = await pool.query(`SELECT pdf_data, invoice_number FROM gcc_world.invoices WHERE id = $1`, [id]);

    if (!invoice?.pdf_data) return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });

    const buffer = Buffer.from(invoice.pdf_data);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="RIDE-${invoice.invoice_number}.pdf"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
