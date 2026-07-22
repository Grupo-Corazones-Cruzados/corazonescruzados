import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { createManualInvoice, sendInvoiceToSri } from '@/lib/integrations/sri';
import { addProjectIncomeToFinance, addTicketIncomeToFinance } from '@/lib/finance';
import { sendViaGmail } from '@/lib/integrations/google-workspace';
import crypto from 'crypto';


export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const {
      project_ids, client_id_type, client_name, client_ruc, client_email,
      client_phone, client_address, payment_code, invoice_items,
      additional_fields, send_email, currency, exchange_rate,
      refactor_source,
    } = await req.json();

    if (!client_name?.trim()) return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 });
    if (!invoice_items?.length) return NextResponse.json({ error: 'Agrega al menos un item a la factura' }, { status: 400 });

    // Create manual invoice
    const { invoiceId, projectsData } = await createManualInvoice({
      projectIds: project_ids || [],
      clientIdType: client_id_type,
      clientName: client_name,
      clientRuc: client_ruc,
      clientEmail: client_email,
      clientPhone: client_phone,
      clientAddress: client_address,
      paymentCode: payment_code,
      invoiceItems: invoice_items,
      additionalFields: additional_fields,
      currency: currency || 'USD',
      exchangeRate: exchange_rate || 1,
    });

    // Register each project as income in monthly finance
    for (const p of projectsData) {
      try {
        await addProjectIncomeToFinance(String(p.id), p.title, p.subtotal || 0);
      } catch (finErr: any) { console.error('Finance registration error:', finErr.message); }
    }

    // Sign and send to SRI
    let sriResult: any = null;
    if (invoiceId) {
      sriResult = await sendInvoiceToSri(invoiceId);

      // REFACTURA: si esta factura re-emite una anulada de un ticket/proyecto, al autorizar
      // el SRI volvemos a marcar ese origen como COMPLETADO, re-registramos su ingreso y
      // re-enlazamos la nueva factura a su origen (para que futuras anulaciones lo reviertan).
      if (sriResult?.authorized && refactor_source?.id && (refactor_source.type === 'ticket' || refactor_source.type === 'project')) {
        try {
          const srcId = String(refactor_source.id);
          const clientId = refactor_source.client_id != null ? Number(refactor_source.client_id) : null;
          if (refactor_source.type === 'ticket') {
            const { rows: [t] } = await pool.query(
              `UPDATE gcc_world.tickets SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING title, estimated_cost`,
              [srcId]
            );
            if (t) await addTicketIncomeToFinance(srcId, t.title, Number(t.estimated_cost) || 0);
            await pool.query(
              `UPDATE gcc_world.invoices SET source_type = 'ticket', source_id = $1, ticket_id = $1${clientId ? ', client_id = $2' : ''} WHERE id = ${clientId ? '$3' : '$2'}`,
              clientId ? [srcId, clientId, invoiceId] : [srcId, invoiceId]
            );
          } else {
            const { rows: [p] } = await pool.query(
              `UPDATE gcc_world.projects SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING title, final_cost`,
              [srcId]
            );
            if (p) await addProjectIncomeToFinance(srcId, p.title, Number(p.final_cost) || 0);
            await pool.query(
              `UPDATE gcc_world.invoices SET project_id = $1${clientId ? ', client_id = $2' : ''} WHERE id = ${clientId ? '$3' : '$2'}`,
              clientId ? [srcId, clientId, invoiceId] : [srcId, invoiceId]
            );
          }
        } catch (e: any) {
          console.error('[manual] refactura re-complete error:', e.message);
        }
      }

      // Send invoice email
      if (send_email && client_email && sriResult?.authorized) {
        try {
          const { rows: [inv] } = await pool.query(
            `SELECT invoice_number, total, pdf_data, access_key, authorization_number, currency, exchange_rate FROM gcc_world.invoices WHERE id = $1`, [invoiceId]
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

          // Build per-project cost sections for the email body
          let projectSectionsHtml = '';
          if (projectsData.length > 1) {
            projectSectionsHtml = projectsData.map((p, idx) => {
              const projSubtotal = p.items.reduce((s: number, it: any) => s + it.quantity * it.unitPrice, 0);
              const itemsRows = p.items.map((it: any) => `
                <tr>
                  <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;color:#242424;">${it.description}</td>
                  <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#242424;">${it.quantity}</td>
                  <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#242424;">$${Number(it.unitPrice).toFixed(2)}</td>
                </tr>
              `).join('');
              return `
                ${idx > 0 ? '<hr style="border:none;border-top:2px dashed #e1dfdd;margin:20px 0;">' : ''}
                <h3 style="color:#4B2D8E;font-size:15px;margin:16px 0 8px;">${p.title}</h3>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e1dfdd;border-radius:6px;overflow:hidden;">
                  <thead>
                    <tr style="background:#f8f8f8;">
                      <th style="padding:8px 12px;font-size:11px;text-align:left;color:#666;">Detalle</th>
                      <th style="padding:8px 12px;font-size:11px;text-align:right;color:#666;">Cant.</th>
                      <th style="padding:8px 12px;font-size:11px;text-align:right;color:#666;">P.Unit.</th>
                    </tr>
                  </thead>
                  <tbody>${itemsRows}</tbody>
                  <tfoot>
                    <tr style="background:#f8f8f8;">
                      <td colspan="2" style="padding:8px 12px;font-size:12px;font-weight:bold;color:#666;">Subtotal Proyecto</td>
                      <td style="padding:8px 12px;font-size:14px;font-weight:bold;text-align:right;color:#1a1a2e;">$${projSubtotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              `;
            }).join('');
          }

          // Generate project URLs for multi-project
          const projectLinks: string[] = [];
          for (const p of projectsData) {
            let url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/proyecto/${p.id}`;
            const { rows: [projInfo] } = await pool.query(`SELECT is_private FROM gcc_world.projects WHERE id = $1`, [p.id]);
            if (projInfo?.is_private) {
              const newToken = crypto.randomBytes(32).toString('hex');
              const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
              await pool.query(`
                ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);
                ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;
              `);
              await pool.query(`UPDATE gcc_world.projects SET public_token = $1, public_token_expires_at = $2 WHERE id = $3`, [newToken, expiresAt, p.id]);
              url += `?token=${newToken}`;
            }
            projectLinks.push(`<a href="${url}" style="display:inline-block;padding:8px 16px;background:#4B2D8E;color:#ffffff;text-decoration:none;font-size:12px;font-weight:bold;border-radius:4px;margin:4px;">${p.title}</a>`);
          }

          await sendViaGmail({
            from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
            to: client_email,
            bcc: 'lfgonzalezm0@grupocc.org',
            subject: `Factura Electrónica ${inv.invoice_number} — GCC World`,
            html: `<div style="font-family:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;background:#faf9f8;padding:0;margin:0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="height:6px;background:#4B2D8E;"></div>
  <div style="padding:30px 40px;">
    <h1 style="color:#1a1a2e;font-size:22px;margin:0 0 6px;">Hola ${clientDisplayName}!</h1>
    <p style="color:#888;font-size:14px;margin:0 0 24px;">Adjunto encontraras tu documento electronico en formato PDF.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e1dfdd;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;width:40%"><strong>Tipo Doc:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">Factura Electronica</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>No. Doc:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">${inv.invoice_number}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Autorizacion:</strong></td><td style="padding:10px 16px;font-size:11px;border-bottom:1px solid #f0f0f0;word-break:break-all;">${inv.authorization_number || 'Pendiente'}</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>RUC Emisor:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">0930095922001</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;border-bottom:1px solid #f0f0f0;"><strong>Razon Social:</strong></td><td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #f0f0f0;">GONZALEZ MUYULEMA LUIS FERNANDO</td></tr>
      <tr><td style="padding:10px 16px;color:#666;font-size:13px;${inv.currency && inv.currency !== 'USD' ? 'border-bottom:1px solid #f0f0f0;' : ''}"><strong>Valor Total:</strong></td><td style="padding:10px 16px;font-size:18px;font-weight:bold;color:#1a1a2e;${inv.currency && inv.currency !== 'USD' ? 'border-bottom:1px solid #f0f0f0;' : ''}">$${Number(inv.total).toFixed(2)} USD</td></tr>
      ${inv.currency && inv.currency !== 'USD' ? `<tr><td style="padding:10px 16px;color:#666;font-size:13px;"><strong>Equivalente ${inv.currency}:</strong></td><td style="padding:10px 16px;font-size:14px;font-weight:bold;color:#4B2D8E;">${(Number(inv.total) * Number(inv.exchange_rate)).toFixed(2)} ${inv.currency} (tasa: 1 USD = ${Number(inv.exchange_rate)} ${inv.currency})</td></tr>` : ''}
    </table>
    ${projectSectionsHtml ? `<div style="margin:24px 0 0;">${projectSectionsHtml}</div>` : ''}
    <div style="text-align:center;margin:24px 0 0;">
      ${projectLinks.join('\n      ')}
    </div>
    <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">Este documento fue generado electronicamente y es valido sin firma ni sello segun la normativa del SRI Ecuador.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
</div>`,
            ...(attachments.length > 0 ? { attachments } : {}),
          });
        } catch (emailErr: any) {
          console.error('Error sending manual invoice email:', emailErr.message);
        }
      }
    }

    return NextResponse.json({ ok: true, invoiceId, sriResult, projectsData });
  } catch (err: any) {
    console.error('Manual invoice error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
