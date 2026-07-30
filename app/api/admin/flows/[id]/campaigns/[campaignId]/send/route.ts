import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { sendViaGmail, workspaceSenderWithName } from '@/lib/integrations/google-workspace';
import { renderTemplate } from '@/lib/flows/variables';


function buildEmailHtml(bodyHtml: string, footerHtml: string): string {
  const footer = footerHtml
    ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e1dfdd;">${footerHtml}</div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;background-color:#faf9f8;margin:0;padding:40px 20px;color:#242424;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;overflow:hidden;border-radius:4px;">
  <div style="padding:32px;font-size:15px;line-height:1.6;color:#242424;">
    ${bodyHtml}
    ${footer}
  </div>
</div></body></html>`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; campaignId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { campaignId } = await params;

    // Fetch campaign
    const { rows: [campaign] } = await pool.query(
      `SELECT * FROM gcc_world.flow_campaigns WHERE id = $1`,
      [campaignId]
    );
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Esta campaña está en proceso de envío' }, { status: 400 });
    }

    // Allow override of email content for resend with different content
    const body = await req.json().catch(() => ({}));
    if (body.body_html !== undefined) campaign.body_html = body.body_html;
    if (body.footer_html !== undefined) campaign.footer_html = body.footer_html;
    if (body.subject !== undefined) campaign.subject = body.subject;
    if (body.attachments !== undefined) campaign.attachments = body.attachments;
    // Del remitente solo se acepta el NOMBRE (`from_name`); `from_email` se sigue leyendo
    // por compatibilidad, pero de él también se toma únicamente el nombre.
    if (body.from_name !== undefined) campaign.from_email = String(body.from_name);
    else if (body.from_email !== undefined) campaign.from_email = String(body.from_email);

    // Del remitente se respeta el NOMBRE, nunca la dirección: el correo sale siempre de la
    // cuenta corporativa que impersona la service account. Un `From` de otro dominio no lo
    // puede firmar Gmail → o lo rechaza o llega como suplantación y cae en spam.
    const sender = workspaceSenderWithName(campaign.from_email);

    // Destinatarios = unión de TODAS las listas asociadas a la campaña, sin repetir correo
    // (un mismo contacto puede estar en dos listas y no debe recibir el correo dos veces).
    // `contact_list_id` es el respaldo de las campañas anteriores a la relación N:M.
    const { rows: contacts } = await pool.query(
      `SELECT DISTINCT ON (LOWER(ct.email)) ct.name, ct.email, ct.phone, ct.position
         FROM gcc_world.flow_contacts ct
        WHERE ct.list_id IN (
                SELECT list_id FROM gcc_world.flow_campaign_lists WHERE campaign_id = $1
                UNION
                SELECT $2::int WHERE $2::int IS NOT NULL
              )
          AND ct.email IS NOT NULL AND ct.email <> ''
        ORDER BY LOWER(ct.email), ct.id`,
      [campaignId, campaign.contact_list_id]
    );
    if (contacts.length === 0) {
      return NextResponse.json({ error: 'La campaña no tiene contactos con correo en sus listas' }, { status: 400 });
    }

    // Mark as sending
    await pool.query(
      `UPDATE gcc_world.flow_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );

    // Parse attachments
    const attachments = (campaign.attachments || []).map((a: any) => {
      if (a.content) {
        return { filename: a.filename, content: Buffer.from(a.content, 'base64') };
      }
      return { filename: a.filename, path: a.url };
    });

    let sentCount = 0;
    let failedCount = 0;

    // Send emails one by one to track individual results
    for (const contact of contacts) {
      try {
        // Las VARIABLES ({{nombre}}, {{correo}}, {{telefono}}, {{puesto}}) se resuelven por
        // contacto: cada correo sale personalizado. En cuerpo y pie el valor va escapado
        // (son HTML); en el asunto, sin escapar pero sin saltos de línea.
        const html = buildEmailHtml(
          renderTemplate(campaign.body_html, contact),
          renderTemplate(campaign.footer_html, contact),
        );
        const result = await sendViaGmail({
          from: sender,
          to: contact.email,
          subject: renderTemplate(campaign.subject, contact, { html: false }),
          html,
          ...(attachments.length > 0 ? { attachments } : {}),
        });

        const resendId = result.id || null;

        await pool.query(
          `INSERT INTO gcc_world.flow_campaign_sends (campaign_id, contact_name, contact_email, resend_id, status, sent_at)
           VALUES ($1, $2, $3, $4, 'sent', NOW())`,
          [campaignId, contact.name, contact.email, resendId]
        );
        sentCount++;
      } catch (sendErr: any) {
        await pool.query(
          `INSERT INTO gcc_world.flow_campaign_sends (campaign_id, contact_name, contact_email, status, error_message, sent_at)
           VALUES ($1, $2, $3, 'failed', $4, NOW())`,
          [campaignId, contact.name, contact.email, sendErr.message || 'Error desconocido']
        );
        failedCount++;
      }
    }

    // Mark campaign as sent
    await pool.query(
      `UPDATE gcc_world.flow_campaigns SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      failed: failedCount,
      total: contacts.length,
    });
  } catch (err: any) {
    console.error('Campaign send error:', err.message);
    // Revert status on error
    const { campaignId } = await params;
    await pool.query(
      `UPDATE gcc_world.flow_campaigns SET status = 'draft', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
