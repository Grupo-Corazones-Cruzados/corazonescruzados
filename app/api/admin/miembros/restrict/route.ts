import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/admin/miembros/restrict - Toggle member project restriction
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { miembroId, restrict } = body;

    if (miembroId === undefined || restrict === undefined) {
      return NextResponse.json({ error: "miembroId y restrict son requeridos" }, { status: 400 });
    }

    if (restrict) {
      await query(
        `UPDATE miembros SET restringido_proyectos = true, restringido_en = NOW() WHERE id = $1`,
        [miembroId]
      );
    } else {
      await query(
        `UPDATE miembros SET restringido_proyectos = false, motivo_restriccion = NULL, restringido_en = NULL WHERE id = $1`,
        [miembroId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error toggling member restriction:", error);
    return NextResponse.json({ error: "Error al actualizar restricción" }, { status: 500 });
  }
}
