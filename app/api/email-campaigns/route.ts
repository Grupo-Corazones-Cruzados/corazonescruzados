import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const isAdmin = auth.role === "admin";
  const result = await query(
    `SELECT ec.*, el.name AS list_name
     FROM email_campaigns ec
     LEFT JOIN email_lists el ON el.id = ec.list_id
     ${isAdmin ? "" : "WHERE ec.created_by = $1"}
     ORDER BY ec.created_at DESC`,
    isAdmin ? [] : [auth.userId]
  );

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { name, subject, html_body, signature_html, list_id, category_filter } =
    await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO email_campaigns
       (name, subject, html_body, signature_html, list_id, category_filter, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
     RETURNING *`,
    [
      name.trim(),
      subject.trim(),
      html_body || null,
      signature_html || null,
      list_id || null,
      category_filter || null,
      auth.userId,
    ]
  );

  return NextResponse.json({ data: result.rows[0] }, { status: 201 });
}
