import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendZeptoMailEmail } from "@/lib/integrations/zeptomail";

/**
 * Resend a campaign.
 * Body: { mode: "all" | "failed" }
 *   - "all"    → resend to every contact in the list
 *   - "failed" → resend only to contacts whose status is failed/bounced
 */

interface CampaignRow {
  id: number;
  subject: string;
  html_body: string | null;
  signature_html: string | null;
  list_id: number | null;
  category_filter: string | null;
  status: string;
}

interface ContactRow {
  id: number;
  name: string;
  email: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaignId = Number(id);

  const body = await req.json().catch(() => ({}));
  const mode: "all" | "failed" = body.mode === "failed" ? "failed" : "all";

  // 1. Get campaign
  const campaignResult = await query<CampaignRow>(
    "SELECT id, subject, html_body, signature_html, list_id, category_filter, status FROM email_campaigns WHERE id = $1",
    [campaignId]
  );

  if (campaignResult.rows.length === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign = campaignResult.rows[0];

  if (campaign.status === "draft") {
    return NextResponse.json(
      { error: "Campaign hasn't been sent yet" },
      { status: 400 }
    );
  }

  if (!campaign.list_id || !campaign.html_body) {
    return NextResponse.json(
      { error: "Campaign is missing list or body" },
      { status: 400 }
    );
  }

  // 2. Determine contacts to resend to
  let contacts: ContactRow[];

  if (mode === "failed") {
    // Only contacts whose email_send status is failed or bounced
    const result = await query<ContactRow>(
      `SELECT ec.id, ec.name, ec.email
       FROM email_contacts ec
       JOIN email_sends es ON es.contact_id = ec.id AND es.campaign_id = $1
       WHERE es.status IN ('failed', 'bounced')
       ORDER BY ec.name ASC`,
      [campaignId]
    );
    contacts = result.rows;
  } else {
    // All contacts in the list (filtered by category if set)
    const conds: string[] = ["ec.list_id = $1"];
    const vals: unknown[] = [campaign.list_id];
    let idx = 2;

    if (campaign.category_filter) {
      conds.push(`ec.category = $${idx}`);
      vals.push(campaign.category_filter);
      idx++;
    }

    const result = await query<ContactRow>(
      `SELECT ec.id, ec.name, ec.email
       FROM email_contacts ec
       WHERE ${conds.join(" AND ")}
       ORDER BY ec.name ASC`,
      vals
    );
    contacts = result.rows;
  }

  if (contacts.length === 0) {
    return NextResponse.json(
      { error: "No eligible recipients found" },
      { status: 400 }
    );
  }

  // 3. Mark campaign as sending
  await query(
    `UPDATE email_campaigns SET status = 'sending' WHERE id = $1`,
    [campaignId]
  );

  // 4. Build full HTML
  const fullHtml = campaign.signature_html
    ? `${campaign.html_body}${campaign.signature_html}`
    : campaign.html_body!;

  // 5. Send to each contact
  let totalSent = 0;
  let totalFailed = 0;

  for (const contact of contacts) {
    let sendStatus: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    let providerId: string | null = null;

    try {
      const result = await sendZeptoMailEmail(
        contact.email,
        contact.name,
        campaign.subject,
        fullHtml
      );
      providerId = result.requestId;
      totalSent++;
    } catch (err) {
      sendStatus = "failed";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      totalFailed++;
    }

    // Upsert: reset tracking fields for resent contacts
    await query(
      `INSERT INTO email_sends (campaign_id, contact_id, status, provider_id, error_message, sent_at,
                                delivered_at, opened_at, clicked_at, bounced_at, bounce_type, bounce_reason)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL, NULL, NULL)
       ON CONFLICT (campaign_id, contact_id) DO UPDATE
         SET status = EXCLUDED.status,
             provider_id = EXCLUDED.provider_id,
             error_message = EXCLUDED.error_message,
             sent_at = EXCLUDED.sent_at,
             delivered_at = NULL,
             opened_at = NULL,
             clicked_at = NULL,
             bounced_at = NULL,
             bounce_type = NULL,
             bounce_reason = NULL`,
      [
        campaignId,
        contact.id,
        sendStatus,
        providerId,
        errorMessage,
        sendStatus === "sent" ? new Date().toISOString() : null,
      ]
    );
  }

  // 6. Update campaign totals
  // Recount from email_sends to get accurate totals
  const totals = await query<{ total: number; sent: number; failed: number }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status IN ('sent', 'delivered'))::int AS sent,
       COUNT(*) FILTER (WHERE status IN ('failed', 'bounced'))::int AS failed
     FROM email_sends
     WHERE campaign_id = $1`,
    [campaignId]
  );

  const t = totals.rows[0];
  await query(
    `UPDATE email_campaigns
     SET total_recipients = $1,
         total_sent = $2,
         total_failed = $3,
         status = 'sent',
         sent_at = NOW()
     WHERE id = $4`,
    [t.total, t.sent, t.failed, campaignId]
  );

  return NextResponse.json({
    data: {
      mode,
      total_resent: contacts.length,
      total_sent: totalSent,
      total_failed: totalFailed,
    },
  });
}
