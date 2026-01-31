import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/admin/users/block - Block or unblock a user
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
    const { userId, block, motivo } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 }
      );
    }

    // Cannot block yourself
    if (userId === tokenData.userId) {
      return NextResponse.json(
        { error: "No puedes bloquearte a ti mismo" },
        { status: 400 }
      );
    }

    // Check if user exists
    const userResult = await query(
      `SELECT id, rol FROM user_profiles WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Cannot block another admin
    if (userResult.rows[0].rol === "admin" && block) {
      return NextResponse.json(
        { error: "No puedes bloquear a otro administrador" },
        { status: 400 }
      );
    }

    // Update user block status using 'estado' column
    if (block) {
      await query(
        `UPDATE user_profiles SET estado = 'suspendido' WHERE id = $1`,
        [userId]
      );
    } else {
      await query(
        `UPDATE user_profiles SET estado = 'activo' WHERE id = $1`,
        [userId]
      );
    }

    // Get updated user
    const updatedUserResult = await query(
      `SELECT up.id, up.email, up.nombre, up.apellido, up.telefono, up.avatar_url,
              up.rol, up.verificado, up.id_miembro, up.created_at, up.estado
       FROM user_profiles up
       WHERE up.id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      user: updatedUserResult.rows[0],
      message: block ? "Usuario suspendido" : "Usuario activado",
    });
  } catch (error) {
    console.error("Error blocking/unblocking user:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
