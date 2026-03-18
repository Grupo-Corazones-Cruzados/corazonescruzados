import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

/**
 * GET /api/whatsapp/campaigns
 * List WhatsApp campaigns for the current user
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const isAdmin = auth.role === "admin";

  const result = await query(
    `SELECT wc.*, el.name AS list_name
     FROM whatsapp_campaigns wc
     LEFT JOIN email_lists el ON el.id = wc.list_id
     ${isAdmin ? "" : "WHERE wc.created_by = $1"}
     ORDER BY wc.created_at DESC`,
    isAdmin ? [] : [auth.userId]
  );

  return NextResponse.json({ data: result.rows });
}

/**
 * POST /api/whatsapp/campaigns
 * Create a new WhatsApp campaign (draft)
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const {
    name,
    message_type = "text",
    message = "",
    template_name,
    template_lang = "es",
    template_vars = [],
    list_id,
    category_filter,
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO whatsapp_campaigns (name, message_type, message, template_name, template_lang, template_vars, list_id, category_filter, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      name.trim(),
      message_type,
      message,
      template_name || null,
      template_lang,
      JSON.stringify(template_vars),
      list_id || null,
      category_filter || null,
      auth.userId,
    ]
  );

  return NextResponse.json({ data: result.rows[0] }, { status: 201 });
}
