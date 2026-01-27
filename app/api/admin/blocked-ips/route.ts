import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/blocked-ips - List blocked IPs
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify admin
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await query(
      `SELECT bi.*, up.email, up.nombre, up.apellido
       FROM blocked_ips bi
       LEFT JOIN user_profiles up ON bi.user_id = up.id
       ORDER BY bi.created_at DESC`
    );

    return NextResponse.json({ blocked_ips: result.rows });
  } catch (error) {
    console.error("Error fetching blocked IPs:", error);
    return NextResponse.json({ error: "Error al cargar IPs bloqueadas" }, { status: 500 });
  }
}

// DELETE /api/admin/blocked-ips - Remove a blocked IP
export async function DELETE(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify admin
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ipId = searchParams.get("id");

    if (!ipId) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    await query("DELETE FROM blocked_ips WHERE id = $1", [parseInt(ipId)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing blocked IP:", error);
    return NextResponse.json({ error: "Error al eliminar IP bloqueada" }, { status: 500 });
  }
}
