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
    `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.phone,
            u.role, u.member_id, u.is_verified, u.created_at,
            u.youtube_handle, u.tiktok_handle, u.instagram_handle, u.facebook_handle,
            c.account_type
     FROM gcc_world.users u
     LEFT JOIN gcc_world.clients c ON c.user_id = u.id
     WHERE u.id = $1`,
    [payload.userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const row = result.rows[0];
  // El admin también puede tener secciones de miembro (CV/Portafolio/Disponibilidad):
  // enlazamos (idempotente) un perfil de miembro sin cambiar su rol.
  // El admin también puede tener secciones de miembro; y el CANDIDATO usa CV/Portafolio/
  // Disponibilidad como su hoja de vida. A ambos se les enlaza (idempotente) un perfil de
  // miembro SIN cambiar su rol (el acceso admin/candidato sigue dependiendo de role/account_type).
  if (!row.member_id && (row.role === "admin" || row.account_type === "candidate")) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
    const memberId = await ensureAdminMember(row.id, row.email, name);
    if (memberId) row.member_id = memberId;
  }

  return NextResponse.json({ user: row });
}
