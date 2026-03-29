import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

function buildEmailHtml(bodyHtml: string, footerHtml: string): string {
  const footer = footerHtml
    ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e0e0e0;">${footerHtml}</div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f5;margin:0;padding:40px 20px;color:#333333;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;overflow:hidden;border-radius:4px;">
  <div style="padding:32px;font-size:15px;line-height:1.6;color:#333333;">
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
    if (body.from_email !== undefined) campaign.from_email = body.from_email;
    if (body.attachments !== undefined) campaign.attachments = body.attachments;

    // Fetch contacts from the linked list
    const { rows: contacts } = await pool.query(
      `SELECT name, email FROM gcc_world.flow_contacts WHERE list_id = $1`,
      [campaign.contact_list_id]
    );
    if (contacts.length === 0) {
      return NextResponse.json({ error: 'La lista de contactos está vacía' }, { status: 400 });
    }

    // Mark as sending
    await pool.query(
      `UPDATE gcc_world.flow_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );

    const resend = getResend();
    const html = buildEmailHtml(campaign.body_html, campaign.footer_html);

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
        const result = await resend.emails.send({
          from: campaign.from_email,
          to: contact.email,
          subject: campaign.subject,
          html,
          ...(attachments.length > 0 ? { attachments } : {}),
        });

        const resendId = result.data?.id || null;

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
