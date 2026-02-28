import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";

export async function GET() {
  const payload = await getCurrentUser();
  if (!payload) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await query(
    `SELECT id, email, first_name, last_name, avatar_url, phone,
            role, member_id, is_verified, created_at
     FROM users WHERE id = $1`,
    [payload.userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: result.rows[0] });
}
