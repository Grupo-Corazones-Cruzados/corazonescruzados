import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendZeptoMailEmail } from "@/lib/integrations/zeptomail";

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

  // 1. Get campaign and verify it's a draft
  const campaignResult = await query<CampaignRow>(
    "SELECT id, subject, html_body, signature_html, list_id, category_filter, status FROM email_campaigns WHERE id = $1",
    [campaignId]
  );

  if (campaignResult.rows.length === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign = campaignResult.rows[0];

  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Campaign has already been sent" },
      { status: 400 }
    );
  }

  if (!campaign.list_id) {
    return NextResponse.json(
      { error: "Campaign has no list assigned" },
      { status: 400 }
    );
  }

  if (!campaign.html_body) {
    return NextResponse.json(
      { error: "Campaign has no email body" },
      { status: 400 }
    );
  }

  // 2. Get contacts in the list, filtered by category if set
  const contactConds: string[] = ["ec.list_id = $1"];
  const contactVals: unknown[] = [campaign.list_id];
  let idx = 2;

  if (campaign.category_filter) {
    contactConds.push(`ec.category = $${idx}`);
    contactVals.push(campaign.category_filter);
    idx++;
  }

  // 3. Exclude contacts that already have an email_send record for this campaign
  contactConds.push(
    `ec.id NOT IN (SELECT es.contact_id FROM email_sends es WHERE es.campaign_id = $${idx})`
  );
  contactVals.push(campaignId);

  const contactsResult = await query<ContactRow>(
    `SELECT ec.id, ec.name, ec.email
     FROM email_contacts ec
     WHERE ${contactConds.join(" AND ")}
     ORDER BY ec.name ASC`,
    contactVals
  );

  const contacts = contactsResult.rows;

  if (contacts.length === 0) {
    return NextResponse.json(
      { error: "No eligible recipients found" },
      { status: 400 }
    );
  }

  // 4. Update campaign to 'sending' and set total_recipients
  await query(
    `UPDATE email_campaigns
     SET status = 'sending', total_recipients = $1
     WHERE id = $2`,
    [contacts.length, campaignId]
  );

  // 5. Build full HTML body (body + signature)
  const fullHtml = campaign.signature_html
    ? `${campaign.html_body}${campaign.signature_html}`
    : campaign.html_body!;

  // 6. Send to each contact individually via ZeptoMail
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
      errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      totalFailed++;
    }

    await query(
      `INSERT INTO email_sends (campaign_id, contact_id, status, provider_id, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (campaign_id, contact_id) DO UPDATE
         SET status = EXCLUDED.status,
             provider_id = EXCLUDED.provider_id,
             error_message = EXCLUDED.error_message,
             sent_at = EXCLUDED.sent_at`,
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

  // 7. Update campaign totals and mark as sent
  await query(
    `UPDATE email_campaigns
     SET total_sent = $1,
         total_failed = $2,
         status = 'sent',
         sent_at = NOW()
     WHERE id = $3`,
    [totalSent, totalFailed, campaignId]
  );

  return NextResponse.json({
    data: {
      total_recipients: contacts.length,
      total_sent: totalSent,
      total_failed: totalFailed,
    },
  });
}
