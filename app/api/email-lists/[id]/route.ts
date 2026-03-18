import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;

  const isAdmin = auth.role === "admin";
  const result = await query(
    `SELECT el.*,
            COALESCE(c.contact_count, 0)::int AS contact_count,
            COALESCE(c.categories, '{}') AS categories
     FROM email_lists el
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS contact_count,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT ec.category), NULL) AS categories
       FROM email_contacts ec
       WHERE ec.list_id = el.id
     ) c ON true
     WHERE el.id = $1 ${isAdmin ? "" : "AND el.created_by = $2"}`,
    isAdmin ? [Number(id)] : [Number(id), auth.userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json({ data: result.rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;

  const isAdmin = auth.role === "admin";
  const result = await query(
    `DELETE FROM email_lists WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [Number(id)] : [Number(id), auth.userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
