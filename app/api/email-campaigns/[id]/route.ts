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
  const campaignResult = await query(
    `SELECT ec.*, el.name AS list_name
     FROM email_campaigns ec
     LEFT JOIN email_lists el ON el.id = ec.list_id
     WHERE ec.id = $1 ${isAdmin ? "" : "AND ec.created_by = $2"}`,
    isAdmin ? [campaignId] : [campaignId, auth.userId]
  );

  if (campaignResult.rows.length === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const sendsResult = await query(
    `SELECT es.*, c.name AS contact_name, c.email AS contact_email
     FROM email_sends es
     JOIN email_contacts c ON c.id = es.contact_id
     WHERE es.campaign_id = $1
     ORDER BY es.created_at ASC`,
    [campaignId]
  );

  return NextResponse.json({
    data: {
      ...campaignResult.rows[0],
      sends: sendsResult.rows,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const campaignId = Number(id);

  // Verify campaign exists, is draft, and belongs to user
  const isAdmin = auth.role === "admin";
  const existing = await query<{ status: string }>(
    `SELECT status FROM email_campaigns WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [campaignId] : [campaignId, auth.userId]
  );

  if (existing.rows.length === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (existing.rows[0].status !== "draft") {
    return NextResponse.json(
      { error: "Only draft campaigns can be edited" },
      { status: 400 }
    );
  }

  const body = await req.json();

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of [
    "name",
    "subject",
    "html_body",
    "signature_html",
    "list_id",
    "category_filter",
  ] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(body[key]);
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(campaignId);
  const result = await query(
    `UPDATE email_campaigns
     SET ${fields.join(", ")}
     WHERE id = $${idx}
     RETURNING *`,
    values
  );

  return NextResponse.json({ data: result.rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;

  const isAdmin = auth.role === "admin";
  const result = await query(
    `DELETE FROM email_campaigns WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [Number(id)] : [Number(id), auth.userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
