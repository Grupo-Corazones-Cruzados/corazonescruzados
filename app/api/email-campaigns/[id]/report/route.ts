import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const campaignId = Number(id);

  const isAdmin = auth.role === "admin";
  const campaignResult = await query<{
    name: string;
    subject: string;
    status: string;
    total_recipients: number;
    total_sent: number;
    total_failed: number;
    sent_at: string | null;
    list_name: string | null;
    category_filter: string | null;
  }>(
    `SELECT ec.name, ec.subject, ec.status,
            ec.total_recipients, ec.total_sent, ec.total_failed,
            ec.sent_at, ec.category_filter,
            el.name AS list_name
     FROM email_campaigns ec
     LEFT JOIN email_lists el ON el.id = ec.list_id
     WHERE ec.id = $1 ${isAdmin ? "" : "AND ec.created_by = $2"}`,
    isAdmin ? [campaignId] : [campaignId, auth.userId]
  );

  if (campaignResult.rows.length === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const campaign = campaignResult.rows[0];

  const sendsResult = await query<{
    contact_name: string;
    contact_email: string;
    contact_phone: string | null;
    contact_category: string | null;
    status: string;
    provider_id: string | null;
    error_message: string | null;
    sent_at: string | null;
    delivered_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounced_at: string | null;
    bounce_type: string | null;
    bounce_reason: string | null;
  }>(
    `SELECT
       c.name AS contact_name,
       c.email AS contact_email,
       c.phone AS contact_phone,
       c.category AS contact_category,
       es.status,
       es.provider_id,
       es.error_message,
       es.sent_at,
       es.delivered_at,
       es.opened_at,
       es.clicked_at,
       es.bounced_at,
       es.bounce_type,
       es.bounce_reason
     FROM email_sends es
     JOIN email_contacts c ON c.id = es.contact_id
     WHERE es.campaign_id = $1
     ORDER BY es.status DESC, c.name ASC`,
    [campaignId]
  );

  return NextResponse.json({
    campaign,
    sends: sendsResult.rows,
  });
}
