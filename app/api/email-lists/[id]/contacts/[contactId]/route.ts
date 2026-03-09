import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id, contactId } = await params;
  const body = await req.json();

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const key of ["name", "email", "phone", "category"] as const) {
    if (body[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(key === "email" ? String(body[key]).trim().toLowerCase() : body[key]);
    }
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  values.push(Number(contactId), Number(id));
  const result = await query(
    `UPDATE email_contacts
     SET ${fields.join(", ")}
     WHERE id = $${idx} AND list_id = $${idx + 1}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ data: result.rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const { id, contactId } = await params;

  const result = await query(
    "DELETE FROM email_contacts WHERE id = $1 AND list_id = $2",
    [Number(contactId), Number(id)]
  );

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
