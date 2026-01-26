import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

export async function GET() {
  try {
    const tokenData = await getCurrentUser();

    if (!tokenData) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Get full user profile
    const result = await query(
      `SELECT id, email, nombre, apellido, avatar_url, telefono, rol, id_miembro, verificado
       FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        avatar_url: user.avatar_url,
        telefono: user.telefono,
        rol: user.rol,
        id_miembro: user.id_miembro,
        verificado: user.verificado,
      },
    });
  } catch (error) {
    console.error("Error obteniendo usuario:", error);
    return NextResponse.json(
      { error: "Error al obtener el perfil" },
      { status: 500 }
    );
  }
}
