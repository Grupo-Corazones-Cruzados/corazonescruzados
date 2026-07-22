import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { createManualInvoiceFromTicket, sendInvoiceToSri } from '@/lib/integrations/sri';
import { addTicketIncomeToFinance } from '@/lib/finance';
import { upsertBillingForClient } from '@/lib/billing-clients';
import { sendViaGmail } from '@/lib/integrations/google-workspace';
import crypto from 'crypto';


async function ensureTicketPublicTokenColumns() {
  await pool.query(`
    ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);
    ALTER TABLE gcc_world.tickets ADD COLUMN IF NOT EXISTS public_token_expires_at TIMESTAMPTZ;
  `);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const {
      ticket_id,
      skip_invoice,
      invoice_items: rawItems,
      client_id_type, client_name, client_ruc, client_email,
      client_phone, client_address, payment_code,
      additional_fields, send_email, currency, exchange_rate,
    } = await req.json();

    if (!ticket_id) return NextResponse.json({ error: 'ticket_id requerido' }, { status: 400 });

    // Load ticket
    const { rows: [ticket] } = await pool.query(
      `SELECT id, title, member_id, estimated_cost, status, client_id FROM gcc_world.tickets WHERE id = $1`,
      [ticket_id]
    );
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    // Auth: la FACTURACIÓN es exclusiva del admin (regla de negocio).
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Solo un administrador puede facturar.' }, { status: 403 });
    }

    // Skip invoice flow: just mark completed and exit
    if (skip_invoice) {
      await pool.query(`UPDATE gcc_world.tickets SET status = 'completed', updated_at = NOW() WHERE id = $1`, [ticket_id]);
      try {
        const estimated = Number(ticket.estimated_cost) || 0;
        if (estimated > 0) await addTicketIncomeToFinance(String(ticket.id), ticket.title, estimated);
      } catch (finErr: any) { console.error('Finance ticket registration error:', finErr.message); }
      return NextResponse.json({ ok: true, invoiceId: null, sriResult: { ok: true, authorized: false, skipped: true } });
    }

    if (!client_name?.trim()) return NextResponse.json({ error: 'Nombre del cliente requerido' }, { status: 400 });
    // Fase 2: para facturar, el ticket debe tener un cliente asociado.
    if (!ticket.client_id) {
      return NextResponse.json({ error: 'Asigna un cliente al ticket antes de facturar.' }, { status: 400 });
    }

    // Normalize editable items array sent from the modal
    const invoice_items = Array.isArray(rawItems)
      ? rawItems
          .map((it: any) => ({
            description: String(it.description || '').trim(),
            quantity: Number(it.quantity) || 0,
            unitPrice: Number(it.unitPrice) || 0,
            ivaRate: Number(it.ivaRate) || 0,
            discount: Number(it.discount) || 0,
          }))
          .filter(it => it.description && it.quantity > 0)
      : [];

    if (invoice_items.length === 0) {
      return NextResponse.json({ error: 'Agrega al menos un item para facturar' }, { status: 400 });
    }

    // Create SRI invoice
    const { invoiceId, total } = await createManualInvoiceFromTicket({
      ticketId: String(ticket.id),
      ticketTitle: ticket.title,
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

    // Register as income
    try {
      await addTicketIncomeToFinance(String(ticket.id), ticket.title, total);
    } catch (finErr: any) { console.error('Finance ticket registration error:', finErr.message); }

    // Fase 2: enlaza la factura al cliente del ticket y crea/actualiza su cuenta de facturación
    // (para prellenar las próximas facturas del mismo cliente).
    try {
      await pool.query(`UPDATE gcc_world.invoices SET client_id = $1 WHERE id = $2`, [ticket.client_id, invoiceId]);
      await upsertBillingForClient(ticket.client_id, {
        id_type: client_id_type, ruc: client_ruc, name: client_name,
        email: client_email, phone: client_phone, address: client_address,
      });
    } catch (e: any) { console.error('[from-ticket] billing upsert error:', e.message); }

    // Sign and send to SRI
    const sriResult = await sendInvoiceToSri(invoiceId);

    // Mark ticket as completed (only if SRI authorized)
    if (sriResult?.authorized) {
      await pool.query(`UPDATE gcc_world.tickets SET status = 'completed', updated_at = NOW() WHERE id = $1`, [ticket_id]);
    }

    // Generate permanent public token for ticket view link
    await ensureTicketPublicTokenColumns();
    const ticketToken = crypto.randomBytes(32).toString('hex');
    // "Permanent" = 100 years from now
    const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE gcc_world.tickets SET public_token = $1, public_token_expires_at = $2 WHERE id = $3`,
      [ticketToken, farFuture, ticket_id]
    );

    // Send email (same template as manual project invoice)
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

        // Build items breakdown table (single "project" section using the ticket)
        const itemsRows = invoice_items.map((it) => `
          <tr>
            <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;color:#242424;">${it.description}</td>
            <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#242424;">${it.quantity}</td>
            <td style="padding:6px 12px;font-size:12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#242424;">$${Number(it.unitPrice).toFixed(2)}</td>
          </tr>
        `).join('');
        const projSubtotal = invoice_items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
        const ticketSectionHtml = `
          <h3 style="color:#4B2D8E;font-size:15px;margin:16px 0 8px;">${ticket.title}</h3>
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
                <td colspan="2" style="padding:8px 12px;font-size:12px;font-weight:bold;color:#666;">Subtotal</td>
                <td style="padding:8px 12px;font-size:14px;font-weight:bold;text-align:right;color:#1a1a2e;">$${projSubtotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        `;

        const ticketUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org'}/ticket/${ticket.id}?token=${ticketToken}`;
        const ticketButton = `<a href="${ticketUrl}" style="display:inline-block;padding:8px 16px;background:#4B2D8E;color:#ffffff;text-decoration:none;font-size:12px;font-weight:bold;border-radius:4px;margin:4px;">Ver Ticket</a>`;

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
    <div style="margin:24px 0 0;">${ticketSectionHtml}</div>
    <div style="text-align:center;margin:24px 0 0;">
      ${ticketButton}
    </div>
    <p style="color:#888;font-size:12px;margin:16px 0 0;text-align:center;">Este documento fue generado electronicamente y es valido sin firma ni sello segun la normativa del SRI Ecuador.</p>
  </div>
  <div style="height:3px;background:#4B2D8E;"></div>
</div>
</div>`,
          ...(attachments.length > 0 ? { attachments } : {}),
        });
      } catch (emailErr: any) {
        console.error('Error sending ticket invoice email:', emailErr.message);
      }
    }

    return NextResponse.json({ ok: true, invoiceId, sriResult });
  } catch (err: any) {
    console.error('Ticket invoice error:', err.message);
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 });
  }
}
