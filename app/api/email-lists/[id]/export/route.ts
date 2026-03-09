import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listId = Number(id);

  const listResult = await query<{ name: string }>(
    "SELECT name FROM email_lists WHERE id = $1",
    [listId]
  );
  if (listResult.rows.length === 0) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const result = await query<{
    name: string;
    email: string;
    phone: string | null;
    category: string | null;
  }>(
    `SELECT name, email, phone, category
     FROM email_contacts
     WHERE list_id = $1
     ORDER BY name ASC`,
    [listId]
  );

  return NextResponse.json({
    list_name: listResult.rows[0].name,
    data: result.rows,
  });
}
