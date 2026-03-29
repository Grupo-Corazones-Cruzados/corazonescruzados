import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { emails } = await req.json();

    if (!emails?.length) return NextResponse.json({ error: 'Correos requeridos' }, { status: 400 });

    const { rows: [inv] } = await pool.query(
      `SELECT invoice_number, total, pdf_data FROM gcc_world.invoices WHERE id = $1`, [id]
    );
    if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (!inv.pdf_data) return NextResponse.json({ error: 'PDF no disponible' }, { status: 400 });

    const pdfBuffer = Buffer.isBuffer(inv.pdf_data) ? inv.pdf_data : Buffer.from(inv.pdf_data);

    await getResend().emails.send({
      from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
      to: emails,
      subject: `Factura Electrónica ${inv.invoice_number} — GCC World`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#333;">Factura Electrónica</h2>
        <p>Estimado/a cliente,</p>
        <p>Adjuntamos su factura electrónica.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">No. Factura</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${inv.invoice_number}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Total</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">$${Number(inv.total).toFixed(2)}</td></tr>
        </table>
        <p style="color:#666;font-size:12px;">Encontrará el detalle completo en el documento PDF adjunto.</p>
        <p style="color:#999;font-size:11px;">Este documento fue generado electrónicamente y es válido sin firma ni sello según la normativa del SRI Ecuador.</p>
      </div>`,
      attachments: [{
        filename: `Factura-${inv.invoice_number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Resend error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
