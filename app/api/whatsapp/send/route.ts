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

/**
 * POST /api/whatsapp/send
 * Quick send (no campaign creation) — sends to a list with rate limiting.
 * Body:
 *   - list_id: number
 *   - category_filter?: string
 *   - message_type: "text" | "template"
 *   - message: string (text body or template name)
 *   - language_code?: string (for templates, default "es")
 *   - template_vars?: { type: string; text: string }[]
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  // 1. Get user's Meta WhatsApp API key
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

  // 2. Parse request body
  const body = await req.json();
  const {
    list_id,
    category_filter,
    message_type = "text",
    message,
    language_code = "es",
    template_vars,
  } = body;

  if (!list_id) {
    return NextResponse.json({ error: "list_id es obligatorio" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message es obligatorio" }, { status: 400 });
  }

  // 3. Verify list ownership
  const isAdmin = auth.role === "admin";
  const listCheck = await query(
    `SELECT id FROM email_lists WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [list_id] : [list_id, auth.userId]
  );

  if (listCheck.rows.length === 0) {
    return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
  }

  // 4. Get contacts with phone numbers
  const contactConds: string[] = ["ec.list_id = $1", "ec.phone IS NOT NULL", "ec.phone != ''"];
  const contactVals: unknown[] = [list_id];
  let idx = 2;

  if (category_filter) {
    contactConds.push(`ec.category = $${idx}`);
    contactVals.push(category_filter);
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

  // 5. Send to each contact (rate limiting is handled in meta-whatsapp integration)
  const metaConfig = { accessToken, phoneNumberId };
  let totalSent = 0;
  let totalFailed = 0;
  const errors: { name: string; phone: string; error: string }[] = [];

  // Build template components if needed
  let templateComponents:
    | { type: "body"; parameters: { type: "text"; text: string }[] }[]
    | undefined;

  if (
    message_type === "template" &&
    template_vars &&
    Array.isArray(template_vars) &&
    template_vars.length > 0
  ) {
    templateComponents = [
      {
        type: "body" as const,
        parameters: template_vars.map((v: { text?: string }) => ({
          type: "text" as const,
          text: v.text || "",
        })),
      },
    ];
  }

  for (const contact of contacts) {
    try {
      if (message_type === "template") {
        await sendWhatsAppTemplateMessage(
          metaConfig,
          contact.phone,
          message.trim(),
          language_code,
          templateComponents
        );
      } else {
        await sendWhatsAppTextMessage(metaConfig, contact.phone, message.trim());
      }
      totalSent++;
    } catch (err) {
      totalFailed++;
      errors.push({
        name: contact.name,
        phone: contact.phone,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    data: {
      total_contacts: contacts.length,
      total_sent: totalSent,
      total_failed: totalFailed,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}
