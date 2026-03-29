import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { createInvoiceFromProject, sendInvoiceToSri } from '@/lib/integrations/sri';
import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { action, review_deadline, send_email, client_id_type, client_email, client_name, client_ruc, client_phone, client_address, payment_code, invoice_items, additional_fields } = await req.json();

    let invoiceId: number | null = null;
    let sriResult: any = null;

    if (action === 'confirm_completion') {
      // Ensure client exists and is linked to project
      const { rows: [proj] } = await pool.query(`SELECT client_id FROM gcc_world.projects WHERE id = $1`, [id]);
      let clientId = proj?.client_id;

      if (!clientId && client_name) {
        // Ensure columns exist
        await pool.query(`
          ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS ruc VARCHAR(13);
          ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS address TEXT;
        `);
        // Create client
        const { rows: [newClient] } = await pool.query(
          `INSERT INTO gcc_world.clients (name, email, phone, ruc, address) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [client_name, client_email || null, client_phone || null, client_ruc || null, client_address || null]
        );
        clientId = newClient.id;
        await pool.query(`UPDATE gcc_world.projects SET client_id = $1 WHERE id = $2`, [clientId, id]);
      } else if (clientId && client_name) {
        // Update existing client data
        await pool.query(`
          ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS ruc VARCHAR(13);
          ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS address TEXT;
        `);
        await pool.query(
          `UPDATE gcc_world.clients SET name = $1, email = $2, phone = $3, ruc = $4, address = $5 WHERE id = $6`,
          [client_name, client_email || null, client_phone || null, client_ruc || null, client_address || null, clientId]
        );
      }

      await pool.query(`UPDATE gcc_world.projects SET status = 'completed', updated_at = NOW() WHERE id = $1`, [id]);

      // Auto-generate SRI invoice
      try {
        invoiceId = await createInvoiceFromProject(id, { clientIdType: client_id_type, paymentCode: payment_code, invoiceItems: invoice_items, additionalFields: additional_fields });

        // Sign and send to SRI
        if (invoiceId) {
          sriResult = await sendInvoiceToSri(invoiceId);

          // Send invoice email to client
          if (send_email && client_email && sriResult?.authorized) {
            try {
              const { rows: [inv] } = await pool.query(
                `SELECT invoice_number, total, pdf_data, access_key, authorization_number FROM gcc_world.invoices WHERE id = $1`, [invoiceId]
              );

              const attachments: any[] = [];
              if (inv.pdf_data) {
                const pdfBuffer = Buffer.isBuffer(inv.pdf_data) ? inv.pdf_data : Buffer.from(inv.pdf_data);
                attachments.push({
                  filename: `Factura-${inv.invoice_number}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                });
              }

              const clientDisplayName = client_name || 'Cliente';
              await getResend().emails.send({
                from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
                to: client_email,
                bcc: 'lfgonzalezm0@grupocc.org',
                subject: `Factura Electrónica ${inv.invoice_number} — GCC World`,
                html: `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="height:6px;background:#4B2D8E;"></div>
  <div style="padding:30px 40px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 6px;">Hola ${clientDisplayName}!</h1>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">Adjunto encontraras tu documento electronico en formato PDF.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;width:40%"><strong>Tipo Doc:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">Factura Electronica</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>No. Doc:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${inv.invoice_number}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Autorizacion:</strong></td><td style="padding:10px 16px;font-size:11px;border-bottom:1px solid #f0f0f0;word-break:break-all;">${inv.authorization_number || 'Pendiente'}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>RUC Emisor:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">0930095922001</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Razon Social:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">GONZALEZ MUYULEMA LUIS FERNANDO</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;"><strong>Valor Total:</strong></td><td style="padding:10px 16px;font-size:18px;font-weight:bold;color:#1a1a2e;">$${Number(inv.total).toFixed(2)}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/proyecto/${id}" style="display:inline-block;padding:12px 24px;background:#4B2D8E;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;border-radius:4px;">Ver Detalle del Proyecto</a>
    </div>
    <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">Este documento fue generado electronicamente y es valido sin firma ni sello segun la normativa del SRI Ecuador.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
</div>`,
                ...(attachments.length > 0 ? { attachments } : {}),
              });
            } catch (emailErr: any) {
              console.error('Error sending invoice email:', emailErr.message);
            }
          }
        }
      } catch (err: any) {
        console.error('Error auto-generating invoice:', err.message);
      }
    } else if (action === 'request_review') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'review', review_deadline = $1, updated_at = NOW() WHERE id = $2`, [review_deadline, id]);
    } else if (action === 'more_requirements') {
      await pool.query(`UPDATE gcc_world.projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [id]);
    }

    const { rows } = await pool.query(`SELECT * FROM gcc_world.projects WHERE id = $1`, [id]);
    return NextResponse.json({ data: rows[0], invoiceId, sriResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
