import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/active - Get active users and members
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const userResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Get active users (logged in within the last 24 hours)
    const activeUsersResult = await query(
      `SELECT
        id, email, nombre, apellido, avatar_url, rol, last_login
       FROM user_profiles
       WHERE last_login IS NOT NULL
         AND last_login > NOW() - INTERVAL '24 hours'
         AND bloqueado = false
       ORDER BY last_login DESC
       LIMIT 10`
    );

    // Get active members with their user info
    const activeMembersResult = await query(
      `SELECT
        m.id, m.nombre, m.puesto, m.foto, m.costo,
        up.last_login, up.avatar_url as user_avatar
       FROM miembros m
       LEFT JOIN user_profiles up ON up.id_miembro = m.id
       WHERE (up.last_login IS NULL OR up.last_login > NOW() - INTERVAL '7 days')
       ORDER BY up.last_login DESC NULLS LAST
       LIMIT 10`
    );

    return NextResponse.json({
      activeUsers: activeUsersResult.rows,
      activeMembers: activeMembersResult.rows,
    });
  } catch (error) {
    console.error("Error fetching active users:", error);
    return NextResponse.json(
      { error: "Error al cargar usuarios activos" },
      { status: 500 }
    );
  }
}
