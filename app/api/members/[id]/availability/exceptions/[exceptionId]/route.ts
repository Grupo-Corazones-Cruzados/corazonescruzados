import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string; exceptionId: string }> };

// DELETE /api/members/[id]/availability/exceptions/[exceptionId] - Delete an exception
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id, exceptionId } = await context.params;
    const miembroId = parseInt(id);

    // Verify user has permission
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { rol, id_miembro } = userResult.rows[0];
    if (rol !== "admin" && id_miembro !== miembroId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await query("DELETE FROM availability_exceptions WHERE id = $1", [parseInt(exceptionId)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting exception:", error);
    return NextResponse.json({ error: "Error al eliminar la excepción" }, { status: 500 });
  }
}
