import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const activeOnly = req.nextUrl.searchParams.get("active_only") !== "false";

  const result = await query(
    `SELECT * FROM positions ${activeOnly ? "WHERE is_active = true" : ""}
     ORDER BY name ASC`
  );

  return NextResponse.json({ data: result.rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  const { name, description } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const result = await query(
    `INSERT INTO positions (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [name, description || null]
  );

  return NextResponse.json({ data: result.rows[0] }, { status: 201 });
}
