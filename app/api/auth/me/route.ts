import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { pool } from "@/lib/db";

export async function GET() {
  const payload = await getCurrentUser();
  if (!payload) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await pool.query(`
    ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS youtube_handle TEXT;
    ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS tiktok_handle TEXT;
    ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
    ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS facebook_handle TEXT;
  `);

  const result = await pool.query(
    `SELECT id, email, first_name, last_name, avatar_url, phone,
            role, member_id, is_verified, created_at,
            youtube_handle, tiktok_handle, instagram_handle, facebook_handle
     FROM gcc_world.users WHERE id = $1`,
    [payload.userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: result.rows[0] });
}
