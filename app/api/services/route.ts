import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const activeOnly = url.get("active_only") !== "false";
  const positionId = url.get("position_id");

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (activeOnly) {
    conds.push("s.is_active = true");
  }
  if (positionId) {
    conds.push(`s.position_id = $${idx++}`);
    vals.push(Number(positionId));
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const result = await query(
    `SELECT s.*, p.name AS position_name
     FROM services s
     LEFT JOIN positions p ON p.id = s.position_id
     ${where}
     ORDER BY p.name, s.name ASC`,
    vals
  );

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  const { name, description, base_price, position_id } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO services (name, description, base_price, position_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, description || null, base_price || 0, position_id || null]
  );

  return NextResponse.json({ data: result.rows[0] }, { status: 201 });
}
