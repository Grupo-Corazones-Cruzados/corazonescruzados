import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

interface SendRow {
  id: number;
  contact_name: string;
  contact_phone: string;
  status: string;
  provider_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}

/**
 * GET /api/whatsapp/campaigns/[id]/report
 * Get detailed send report for a WhatsApp campaign
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const isAdmin = auth.role === "admin";

  // Check campaign exists and user has access
  const campaignResult = await query(
    `SELECT wc.*, el.name AS list_name
     FROM whatsapp_campaigns wc
     LEFT JOIN email_lists el ON el.id = wc.list_id
     WHERE wc.id = $1 ${isAdmin ? "" : "AND wc.created_by = $2"}`,
    isAdmin ? [id] : [id, auth.userId]
  );

  if (campaignResult.rows.length === 0) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  const campaign = campaignResult.rows[0];

  // Get all sends with contact info
  const sendsResult = await query<SendRow>(
    `SELECT ws.id, ec.name AS contact_name, ec.phone AS contact_phone,
            ws.status, ws.provider_id, ws.error_message,
            ws.sent_at, ws.delivered_at, ws.read_at
     FROM whatsapp_sends ws
     JOIN email_contacts ec ON ec.id = ws.contact_id
     WHERE ws.campaign_id = $1
     ORDER BY ec.name ASC`,
    [id]
  );

  return NextResponse.json({
    data: {
      campaign,
      sends: sendsResult.rows,
    },
  });
}
