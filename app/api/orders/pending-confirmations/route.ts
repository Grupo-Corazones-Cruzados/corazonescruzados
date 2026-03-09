import { NextRequest, NextResponse } from "next/server";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import { listPendingConfirmationsForMember } from "@/lib/services/marketplace-service";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "member", "admin");
  if (isErrorResponse(auth)) return auth;

  // Resolve member_id for this user
  const userRes = await query("SELECT member_id FROM users WHERE id = $1", [auth.userId]);
  const memberId = userRes.rows[0]?.member_id;
  if (!memberId) {
    return NextResponse.json({ data: [] });
  }

  const orders = await listPendingConfirmationsForMember(memberId);
  return NextResponse.json({ data: orders });
}
