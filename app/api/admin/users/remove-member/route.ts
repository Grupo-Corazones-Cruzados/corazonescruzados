import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/admin/users/remove-member - Remove member role from user
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
    const { userId, deleteMemberRecord } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 }
      );
    }

    // Get user data
    const userResult = await query(
      `SELECT id, id_miembro, rol FROM user_profiles WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (!user.id_miembro) {
      return NextResponse.json(
        { error: "El usuario no es un miembro" },
        { status: 400 }
      );
    }

    const memberId = user.id_miembro;

    // Update user profile - remove member link and change role to cliente
    await query(
      `UPDATE user_profiles
       SET id_miembro = NULL, rol = 'cliente'
       WHERE id = $1`,
      [userId]
    );

    // Optionally delete the member record
    if (deleteMemberRecord) {
      await query(`DELETE FROM miembros WHERE id = $1`, [memberId]);
    }

    // Get updated user
    const updatedUserResult = await query(
      `SELECT up.id, up.email, up.nombre, up.apellido, up.telefono, up.avatar_url,
              up.rol, up.verificado, up.id_miembro, up.created_at, up.bloqueado
       FROM user_profiles up
       WHERE up.id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      user: updatedUserResult.rows[0],
      message: deleteMemberRecord
        ? "Miembro removido y registro eliminado"
        : "Miembro removido (registro conservado)",
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Error al quitar miembro" },
      { status: 500 }
    );
  }
}
