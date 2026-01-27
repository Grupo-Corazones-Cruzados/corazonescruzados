import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/admin/users/delete - Delete a user permanently
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const adminResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (adminResult.rows.length === 0 || adminResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 }
      );
    }

    // Get user info
    const userResult = await query(
      `SELECT id, email, rol, id_miembro FROM user_profiles WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Prevent deleting yourself
    if (user.id === tokenData.userId) {
      return NextResponse.json(
        { error: "No puedes eliminar tu propia cuenta" },
        { status: 400 }
      );
    }

    // Prevent deleting admins
    if (user.rol === "admin") {
      return NextResponse.json(
        { error: "No se puede eliminar a un administrador" },
        { status: 400 }
      );
    }

    // If user is linked to a member, unlink first
    if (user.id_miembro) {
      // Just unlink, don't delete the member record
      await query(
        `UPDATE user_profiles SET id_miembro = NULL WHERE id = $1`,
        [userId]
      );
    }

    // Delete the user
    await query(`DELETE FROM user_profiles WHERE id = $1`, [userId]);

    return NextResponse.json({
      success: true,
      message: "Usuario eliminado correctamente",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Error al eliminar usuario" },
      { status: 500 }
    );
  }
}
