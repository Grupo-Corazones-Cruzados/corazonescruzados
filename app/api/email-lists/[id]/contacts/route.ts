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
  const listId = Number(id);

  // Verify list ownership
  const isAdmin = auth.role === "admin";
  const ownerCheck = await query(
    `SELECT id FROM email_lists WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [listId] : [listId, auth.userId]
  );
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const url = req.nextUrl.searchParams;

  const search = url.get("search")?.trim() || "";
  const category = url.get("category")?.trim() || "";
  const page = Math.max(1, Number(url.get("page")) || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.get("per_page")) || 20));
  const offset = (page - 1) * perPage;

  const conds: string[] = ["ec.list_id = $1"];
  const vals: unknown[] = [listId];
  let idx = 2;

  if (search) {
    conds.push(`(ec.name ILIKE $${idx} OR ec.email ILIKE $${idx})`);
    vals.push(`%${search}%`);
    idx++;
  }

  if (category) {
    conds.push(`ec.category = $${idx}`);
    vals.push(category);
    idx++;
  }

  const where = `WHERE ${conds.join(" AND ")}`;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM email_contacts ec ${where}`,
    vals
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await query(
    `SELECT ec.*
     FROM email_contacts ec
     ${where}
     ORDER BY ec.name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...vals, perPage, offset]
  );

  return NextResponse.json({
    data: dataResult.rows,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const listId = Number(id);
  const body = await req.json();

  // Verify list ownership
  const isAdmin = auth.role === "admin";
  const listCheck = await query(
    `SELECT id FROM email_lists WHERE id = $1 ${isAdmin ? "" : "AND created_by = $2"}`,
    isAdmin ? [listId] : [listId, auth.userId]
  );
  if (listCheck.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  // Normalize to array
  const contacts: { name: string; email: string; phone?: string; category?: string }[] =
    Array.isArray(body.contacts) ? body.contacts : [body];

  if (contacts.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
  }

  // Validate all entries
  for (const c of contacts) {
    if (!c.name || !c.email) {
      return NextResponse.json(
        { error: "Each contact must have name and email" },
        { status: 400 }
      );
    }
  }

  // Build multi-row INSERT
  const values: unknown[] = [];
  const rows: string[] = [];
  let idx = 1;

  for (const c of contacts) {
    rows.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
    values.push(listId, c.name.trim(), c.email.trim().toLowerCase(), c.phone || null, c.category || null);
    idx += 5;
  }

  const result = await query(
    `INSERT INTO email_contacts (list_id, name, email, phone, category)
     VALUES ${rows.join(", ")}
     RETURNING *`,
    values
  );

  return NextResponse.json({ data: result.rows }, { status: 201 });
}
