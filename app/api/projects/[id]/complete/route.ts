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

              await getResend().emails.send({
                from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
                to: client_email,
                subject: `Factura Electrónica ${inv.invoice_number} — GCC World`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h2 style="color:#333;">Factura Electrónica</h2>
                  <p>Estimado/a cliente,</p>
                  <p>Adjuntamos su factura electrónica correspondiente al proyecto completado.</p>
                  <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">No. Factura</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${inv.invoice_number}</td></tr>
                    <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Total</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">$${Number(inv.total).toFixed(2)}</td></tr>
                  </table>
                  <p style="color:#666;font-size:12px;">Encontrará el detalle completo en el documento PDF adjunto.</p>
                  <p style="color:#999;font-size:11px;">Este documento fue generado electrónicamente y es válido sin firma ni sello según la normativa del SRI Ecuador.</p>
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
