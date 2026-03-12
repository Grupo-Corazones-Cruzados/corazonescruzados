import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;

  const result = await query(
    `SELECT DISTINCT c.id, c.name, c.email, c.phone
     FROM clients c
     JOIN projects p ON p.client_id = c.id
     WHERE p.assigned_member_id = $1
     ORDER BY c.name`,
    [Number(id)]
  );

  return NextResponse.json({ data: result.rows });
}
