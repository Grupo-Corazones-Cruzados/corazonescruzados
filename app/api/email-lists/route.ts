import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
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
       ORDER BY el.created_at DESC`
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error("GET /api/email-lists error:", err);
    return NextResponse.json(
      { error: "Error al cargar listas", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { name, description } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO email_lists (name, description, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name.trim(), description || null, null]
  );

  return NextResponse.json({ data: result.rows[0] }, { status: 201 });
}
