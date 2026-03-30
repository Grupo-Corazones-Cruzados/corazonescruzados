import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import crypto from 'crypto';

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
      `SELECT invoice_number, total, pdf_data, authorization_number, client_name_sri, project_id, currency, exchange_rate FROM gcc_world.invoices WHERE id = $1`, [id]
    );
    if (!inv) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (!inv.pdf_data) return NextResponse.json({ error: 'PDF no disponible' }, { status: 400 });

    const pdfBuffer = Buffer.isBuffer(inv.pdf_data) ? inv.pdf_data : Buffer.from(inv.pdf_data);

    // Generate token for private projects (expires in 1 week)
    let projectUrl = '';
    if (inv.project_id) {
      projectUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/proyecto/${inv.project_id}`;
      const { rows: [proj] } = await pool.query(`SELECT is_private FROM gcc_world.projects WHERE id = $1`, [inv.project_id]);
      if (proj?.is_private) {
        const newToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await pool.query(`
          ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);
          ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;
        `);
        await pool.query(`UPDATE gcc_world.projects SET public_token = $1, public_token_expires_at = $2 WHERE id = $3`, [newToken, expiresAt, inv.project_id]);
        projectUrl += `?token=${newToken}`;
      }
    }

    await getResend().emails.send({
      from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
      to: emails,
      bcc: 'lfgonzalezm0@grupocc.org',
      subject: `Factura Electrónica ${inv.invoice_number} — GCC World`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="height:6px;background:#4B2D8E;"></div>
  <div style="padding:30px 40px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 6px;">Hola ${inv.client_name_sri || 'Cliente'}!</h1>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">Adjunto encontraras tu documento electronico en formato PDF.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;width:40%"><strong>Tipo Doc:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">Factura Electronica</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>No. Doc:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${inv.invoice_number}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Autorizacion:</strong></td><td style="padding:10px 16px;font-size:11px;border-bottom:1px solid #f0f0f0;word-break:break-all;">${inv.authorization_number || 'Pendiente'}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>RUC Emisor:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">0930095922001</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Razon Social:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">GONZALEZ MUYULEMA LUIS FERNANDO</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;${inv.currency && inv.currency !== 'USD' ? 'border-bottom:1px solid #f0f0f0;' : ''}"><strong>Valor Total:</strong></td><td style="padding:10px 16px;font-size:18px;font-weight:bold;color:#1a1a2e;${inv.currency && inv.currency !== 'USD' ? 'border-bottom:1px solid #f0f0f0;' : ''}">$${Number(inv.total).toFixed(2)} USD</td></tr>
      ${inv.currency && inv.currency !== 'USD' ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;"><strong>Equivalente ${inv.currency}:</strong></td><td style="padding:10px 16px;font-size:14px;font-weight:bold;color:#4B2D8E;">${(Number(inv.total) * Number(inv.exchange_rate)).toFixed(2)} ${inv.currency} (tasa: 1 USD = ${Number(inv.exchange_rate)} ${inv.currency})</td></tr>` : ''}
    </table>
    ${projectUrl ? `<div style="text-align:center;margin:24px 0 0;">
      <a href="${projectUrl}" style="display:inline-block;padding:12px 24px;background:#4B2D8E;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;border-radius:4px;">Ver Detalle del Proyecto</a>
    </div>` : ''}
    <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">Este documento fue generado electronicamente y es valido sin firma ni sello segun la normativa del SRI Ecuador.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
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
