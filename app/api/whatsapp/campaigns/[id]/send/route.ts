import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";
import {
  sendWhatsAppTextMessage,
  sendWhatsAppTemplateMessage,
} from "@/lib/integrations/meta-whatsapp";

interface UserApiKeyRow {
  api_key: string;
  config: { phone_number_id?: string; business_account_id?: string };
}

interface ContactRow {
  id: number;
  name: string;
  phone: string;
}

interface CampaignRow {
  id: number;
  message_type: "text" | "template";
  message: string;
  template_name: string | null;
  template_lang: string | null;
  template_vars: { type: string; text?: string }[];
  list_id: number | null;
  category_filter: string | null;
  status: string;
  created_by: string;
}

/**
 * POST /api/whatsapp/campaigns/[id]/send
 * Send a WhatsApp campaign to all eligible contacts
 * Includes rate limiting (80 msg/sec) and DB tracking
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const isAdmin = auth.role === "admin";

  // 1. Get campaign
  const campaignResult = await query<CampaignRow>(
    `SELECT * FROM whatsapp_campaigns WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [id] : [id, auth.userId]
  );

  if (campaignResult.rows.length === 0) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  const campaign = campaignResult.rows[0];

  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Solo se pueden enviar campañas en estado borrador" },
      { status: 400 }
    );
  }

  if (!campaign.list_id) {
    return NextResponse.json(
      { error: "La campaña debe tener una lista de contactos asignada" },
      { status: 400 }
    );
  }

  // 2. Get Meta WhatsApp config
  const keyResult = await query<UserApiKeyRow>(
    `SELECT api_key, config FROM user_api_keys WHERE user_id = $1 AND service = 'meta_whatsapp'`,
    [auth.userId]
  );

  if (keyResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Meta WhatsApp API no configurada" },
      { status: 400 }
    );
  }

  const { api_key: accessToken, config } = keyResult.rows[0];
  const phoneNumberId = config.phone_number_id;

  if (!phoneNumberId) {
    return NextResponse.json(
      { error: "Phone Number ID no configurado" },
      { status: 400 }
    );
  }

  // 3. Get contacts
  const contactConds: string[] = [
    "ec.list_id = $1",
    "ec.phone IS NOT NULL",
    "ec.phone != ''",
  ];
  const contactVals: unknown[] = [campaign.list_id];
  let idx = 2;

  if (campaign.category_filter) {
    contactConds.push(`ec.category = $${idx}`);
    contactVals.push(campaign.category_filter);
    idx++;
  }

  const contactsResult = await query<ContactRow>(
    `SELECT ec.id, ec.name, ec.phone
     FROM email_contacts ec
     WHERE ${contactConds.join(" AND ")}
     ORDER BY ec.name ASC`,
    contactVals
  );

  const contacts = contactsResult.rows;

  if (contacts.length === 0) {
    return NextResponse.json(
      { error: "No se encontraron contactos con número de teléfono" },
      { status: 400 }
    );
  }

  // 4. Mark campaign as sending
  await query(
    `UPDATE whatsapp_campaigns SET status = 'sending', total_recipients = $1 WHERE id = $2`,
    [contacts.length, id]
  );

  // 5. Create send records
  const insertValues: string[] = [];
  const insertParams: unknown[] = [];
  let paramIdx = 1;

  for (const contact of contacts) {
    insertValues.push(`($${paramIdx}, $${paramIdx + 1})`);
    insertParams.push(id, contact.id);
    paramIdx += 2;
  }

  await query(
    `INSERT INTO whatsapp_sends (campaign_id, contact_id)
     VALUES ${insertValues.join(", ")}
     ON CONFLICT (campaign_id, contact_id) DO NOTHING`,
    insertParams
  );

  // 6. Send messages with rate limiting (handled by meta-whatsapp integration)
  const metaConfig = { accessToken, phoneNumberId };
  let totalSent = 0;
  let totalFailed = 0;

  // Build template components if needed
  let templateComponents: { type: "body"; parameters: { type: "text"; text: string }[] }[] | undefined;
  if (
    campaign.message_type === "template" &&
    campaign.template_vars &&
    campaign.template_vars.length > 0
  ) {
    templateComponents = [
      {
        type: "body" as const,
        parameters: campaign.template_vars.map((v) => ({
          type: "text" as const,
          text: v.text || "",
        })),
      },
    ];
  }

  for (const contact of contacts) {
    try {
      let messageId: string | null = null;

      if (campaign.message_type === "template" && campaign.template_name) {
        const result = await sendWhatsAppTemplateMessage(
          metaConfig,
          contact.phone,
          campaign.template_name,
          campaign.template_lang || "es",
          templateComponents
        );
        messageId = result.messageId;
      } else {
        const result = await sendWhatsAppTextMessage(
          metaConfig,
          contact.phone,
          campaign.message
        );
        messageId = result.messageId;
      }

      // Update send record as sent
      await query(
        `UPDATE whatsapp_sends SET status = 'sent', provider_id = $1, sent_at = NOW()
         WHERE campaign_id = $2 AND contact_id = $3`,
        [messageId, id, contact.id]
      );

      totalSent++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";

      await query(
        `UPDATE whatsapp_sends SET status = 'failed', error_message = $1, sent_at = NOW()
         WHERE campaign_id = $2 AND contact_id = $3`,
        [errorMsg, id, contact.id]
      );

      totalFailed++;
    }
  }

  // 7. Update campaign totals
  const finalStatus = totalFailed === contacts.length ? "failed" : "sent";
  await query(
    `UPDATE whatsapp_campaigns
     SET status = $1, total_sent = $2, total_failed = $3, sent_at = NOW()
     WHERE id = $4`,
    [finalStatus, totalSent, totalFailed, id]
  );

  return NextResponse.json({
    data: {
      total_contacts: contacts.length,
      total_sent: totalSent,
      total_failed: totalFailed,
    },
  });
}
