import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";
import { getWhatsAppTemplates } from "@/lib/integrations/meta-whatsapp";

interface UserApiKeyRow {
  api_key: string;
  config: { phone_number_id?: string; business_account_id?: string };
}

/**
 * GET /api/whatsapp/templates
 * Fetch approved WhatsApp message templates from Meta Business API
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

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
  const businessAccountId = config.business_account_id;

  if (!phoneNumberId || !businessAccountId) {
    return NextResponse.json(
      { error: "Phone Number ID y WABA ID son necesarios" },
      { status: 400 }
    );
  }

  try {
    const templates = await getWhatsAppTemplates({
      accessToken,
      phoneNumberId,
      businessAccountId,
    });

    return NextResponse.json({ data: templates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener plantillas" },
      { status: 500 }
    );
  }
}
