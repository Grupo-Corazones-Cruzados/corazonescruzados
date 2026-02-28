import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const activeOnly = url.get("active_only") !== "false";

  const result = await query(
    `SELECT * FROM services ${activeOnly ? "WHERE is_active = true" : ""}
     ORDER BY name ASC`
  );

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  const { name, description, base_price } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO services (name, description, base_price)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description, base_price]
  );

  return NextResponse.json({ data: result.rows[0] }, { status: 201 });
}
