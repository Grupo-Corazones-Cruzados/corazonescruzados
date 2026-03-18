import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/whatsapp/campaigns/[id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const isAdmin = auth.role === "admin";

  const result = await query(
    `SELECT wc.*, el.name AS list_name
     FROM whatsapp_campaigns wc
     LEFT JOIN email_lists el ON el.id = wc.list_id
     WHERE wc.id = $1 ${isAdmin ? "" : "AND wc.created_by = $2"}`,
    isAdmin ? [id] : [id, auth.userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: result.rows[0] });
}

/**
 * PATCH /api/whatsapp/campaigns/[id]
 * Update a draft campaign
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const isAdmin = auth.role === "admin";

  // Verify ownership and draft status
  const existing = await query(
    `SELECT id, status FROM whatsapp_campaigns WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [id] : [id, auth.userId]
  );

  if (existing.rows.length === 0) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  if (existing.rows[0].status !== "draft") {
    return NextResponse.json(
      { error: "Solo se pueden editar campañas en borrador" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  const allowed = [
    "name", "message_type", "message", "template_name",
    "template_lang", "list_id", "category_filter",
  ];

  for (const key of allowed) {
    if (key in body) {
      sets.push(`${key} = $${idx}`);
      vals.push(body[key]);
      idx++;
    }
  }

  if ("template_vars" in body) {
    sets.push(`template_vars = $${idx}`);
    vals.push(JSON.stringify(body.template_vars));
    idx++;
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  vals.push(id);
  const result = await query(
    `UPDATE whatsapp_campaigns SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );

  return NextResponse.json({ data: result.rows[0] });
}

/**
 * DELETE /api/whatsapp/campaigns/[id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const isAdmin = auth.role === "admin";

  const result = await query(
    `DELETE FROM whatsapp_campaigns WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [id] : [id, auth.userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ message: "Eliminada" });
}
