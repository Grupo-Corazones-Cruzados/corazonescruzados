import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const result = await query(
    `SELECT * FROM modules ORDER BY sort_order ASC`
  );

  // Filter by user's role
  const modules = result.rows.filter((m: { allowed_roles: string[] }) =>
    m.allowed_roles.includes(auth.role)
  );

  return NextResponse.json({ data: modules });
}
