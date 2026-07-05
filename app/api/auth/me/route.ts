import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { pool } from "@/lib/db";
import { ensureAdminMember } from "@/lib/ensure-admin-member";

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

  const row = result.rows[0];
  // El admin también puede tener secciones de miembro (CV/Portafolio/Disponibilidad):
  // enlazamos (idempotente) un perfil de miembro sin cambiar su rol.
  if (row.role === "admin" && !row.member_id) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
    const memberId = await ensureAdminMember(row.id, row.email, name);
    if (memberId) row.member_id = memberId;
  }

  return NextResponse.json({ user: row });
}
