import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { createManualInvoiceFromSubscription, sendInvoiceToSri } from '@/lib/integrations/sri';
import { addSubscriptionIncomeToFinance } from '@/lib/finance';
import { ensureSubscriptionTables, computePeriods } from '@/lib/subscriptions';
import { sendViaGmail } from '@/lib/integrations/google-workspace';


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureSubscriptionTables();

    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const action = String(body.action || 'pay');
    const period = String(body.period || '').slice(0, 7); // 'YYYY-MM'
    const sendEmail = body.send_email !== false; // default true

    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'Periodo inválido' }, { status: 400 });
    }

    // Load subscription
    const { rows: [sub] } = await pool.query(
      `SELECT * FROM gcc_world.subscriptions WHERE id = $1`, [id]
    );
    if (!sub) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });

    // Validate the period is an actual billable month for this subscription.
    const periods = computePeriods(sub.start_date, []);
    const periodInfo = periods.find(p => p.period === period);
    if (!periodInfo) {
      return NextResponse.json({ error: 'Ese mes aún no corresponde a esta suscripción' }, { status: 400 });
    }
    const periodDate = `${period}-01`;

    // ---- UNMARK ----
    if (action === 'unpay') {
      const { rows: [existing] } = await pool.query(
        `SELECT id, invoice_id FROM gcc_world.subscription_payments WHERE subscription_id = $1 AND period = $2`,
        [id, periodDate]
      );
      if (!existing) return NextResponse.json({ ok: true, paid: false });
      if (existing.invoice_id) {
        return NextResponse.json({
          error: 'No se puede desmarcar: este mes ya tiene una factura electrónica emitida. Para revertirla se requiere una nota de crédito.',
        }, { status: 409 });
      }
      await pool.query(`DELETE FROM gcc_world.subscription_payments WHERE id = $1`, [existing.id]);
      return NextResponse.json({ ok: true, paid: false });
    }

    // ---- MARK PAID (→ invoice + income + email) ----
    // Idempotency: if already paid with an invoice, do nothing.
    const { rows: [already] } = await pool.query(
      `SELECT id, paid, invoice_id FROM gcc_world.subscription_payments WHERE subscription_id = $1 AND period = $2`,
      [id, periodDate]
    );
    if (already?.paid && already?.invoice_id) {
      return NextResponse.json({ ok: true, paid: true, invoiceId: already.invoice_id, alreadyPaid: true });
    }

    // Compute amounts — monthly_cost is the FINAL price with IVA included → break it
    // back out: base = total / (1 + iva/100), so total billed == monthly_cost.
    const ivaRate = Number(sub.iva_rate) || 0;
    const total = Number(sub.monthly_cost);
    const base = ivaRate > 0 ? total / (1 + ivaRate / 100) : total;
    const description = `${sub.title} — ${periodInfo.label}`;

    let invoiceId: number;
    let invoiceTotal: number;
    try {
      const res = await createManualInvoiceFromSubscription({
        subscriptionId: String(id),
        period,
        title: sub.title,
        clientIdType: sub.client_id_type,
        clientName: sub.client_name_sri || 'CONSUMIDOR FINAL',
        clientRuc: sub.client_ruc,
        clientEmail: sub.client_email_sri,
        clientPhone: sub.client_phone_sri,
        clientAddress: sub.client_address_sri,
        paymentCode: sub.payment_code,
        invoiceItems: [{ description, quantity: 1, unitPrice: base, ivaRate, discount: 0 }],
        currency: sub.currency || 'USD',
        exchangeRate: 1,
      });
      invoiceId = res.invoiceId;
      invoiceTotal = res.total;
    } catch (e: any) {
      console.error('Subscription invoice creation error:', e.message);
      return NextResponse.json({ error: 'No se pudo generar la factura: ' + (e.message || 'error') }, { status: 500 });
    }

    // Sign + send to SRI
    const sriResult = await sendInvoiceToSri(invoiceId);

    if (!sriResult?.authorized) {
      // No se marca pagado si el SRI no autorizó. La factura queda en estado
      // 'generated' (visible en Facturas para reintentar/revisar).
      return NextResponse.json({
        error: 'El SRI no autorizó la factura' + (sriResult?.error ? `: ${sriResult.error}` : '') + '. El mes no se marcó como pagado.',
        invoiceId,
        sriResult,
      }, { status: 502 });
    }

    // Register income in the month the cuota is marked paid (now).
    try {
      await addSubscriptionIncomeToFinance(`${id}-${period}`, description, invoiceTotal, new Date());
    } catch (finErr: any) {
      console.error('Subscription finance registration error:', finErr.message);
    }

    // Persist the paid mark with its invoice link.
    await pool.query(
      `INSERT INTO gcc_world.subscription_payments (subscription_id, period, paid, paid_at, paid_by, invoice_id, amount)
       VALUES ($1, $2, true, NOW(), $3, $4, $5)
       ON CONFLICT (subscription_id, period)
       DO UPDATE SET paid = true, paid_at = NOW(), paid_by = EXCLUDED.paid_by, invoice_id = EXCLUDED.invoice_id, amount = EXCLUDED.amount`,
      [id, periodDate, user.email, invoiceId, invoiceTotal]
    );

    // Email the client their invoice (same approach as ticket/project invoices).
    let emailed = false;
    if (sendEmail && sub.client_email_sri) {
      try {
        const { rows: [inv] } = await pool.query(
          `SELECT invoice_number, total, pdf_data, authorization_number FROM gcc_world.invoices WHERE id = $1`,
          [invoiceId]
        );
        const attachments: any[] = [];
        if (inv?.pdf_data) {
          const pdfBuffer = Buffer.isBuffer(inv.pdf_data) ? inv.pdf_data : Buffer.from(inv.pdf_data);
          attachments.push({ filename: `Factura-${inv.invoice_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' });
        }
        const clientDisplayName = sub.client_name_sri || 'Cliente';
        const html = `
          <div style="font-family:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#242424;">
            <div style="background:#4B2D8E;padding:20px;text-align:center;">
              <h1 style="color:#fff;font-size:18px;margin:0;">GCC World — Factura Electrónica</h1>
            </div>
            <div style="padding:24px;">
              <p style="font-size:13px;">Estimado/a <strong>${clientDisplayName}</strong>,</p>
              <p style="font-size:13px;">Adjuntamos la factura electrónica correspondiente a su suscripción:</p>
              <h3 style="color:#4B2D8E;font-size:15px;margin:16px 0 8px;">${sub.title} — ${periodInfo.label}</h3>
              <table style="width:100%;border-collapse:collapse;border:1px solid #e1dfdd;border-radius:6px;overflow:hidden;">
                <tbody>
                  <tr>
                    <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#242424;">Factura N°</td>
                    <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right;color:#242424;">${inv?.invoice_number || ''}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f0f0f0;color:#242424;">Autorización SRI</td>
                    <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right;color:#242424;">${sriResult.authNumber || inv?.authorization_number || ''}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 12px;font-size:14px;font-weight:bold;color:#4B2D8E;">Total</td>
                    <td style="padding:8px 12px;font-size:14px;font-weight:bold;text-align:right;color:#4B2D8E;">$${Number(inv?.total ?? invoiceTotal).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <p style="font-size:12px;color:#888;margin-top:20px;">Gracias por su preferencia.<br/>GCC World</p>
            </div>
          </div>`;
        await sendViaGmail({
          from: process.env.EMAIL_FROM || 'GCC World <noreply@gccworld.com>',
          to: sub.client_email_sri,
          bcc: 'lfgonzalezm0@grupocc.org',
          subject: `Factura Electrónica ${inv?.invoice_number || ''} — GCC World`,
          html,
          attachments,
        });
        emailed = true;
      } catch (mailErr: any) {
        console.error('Subscription invoice email error:', mailErr.message);
      }
    }

    return NextResponse.json({ ok: true, paid: true, invoiceId, total: invoiceTotal, emailed, sriResult });
  } catch (err: any) {
    console.error('Subscription pay error:', err.message);
    return NextResponse.json({ error: 'Error al procesar el cobro' }, { status: 500 });
  }
}
