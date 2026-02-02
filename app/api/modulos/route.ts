import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/modulos - List all active modules filtered by user role
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener el rol del usuario
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const userRole = userResult.rows[0]?.rol || "cliente";

    // Obtener módulos activos filtrados por rol
    const result = await query(
      `SELECT id, nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos, secciones
       FROM modulos
       WHERE activo = true
         AND (roles_permitidos IS NULL
              OR array_length(roles_permitidos, 1) IS NULL
              OR $1 = ANY(roles_permitidos))
       ORDER BY orden ASC`,
      [userRole]
    );

    return NextResponse.json({ modulos: result.rows });
  } catch (error) {
    console.error("Error fetching modulos:", error);
    return NextResponse.json({ error: "Error al cargar los módulos" }, { status: 500 });
  }
}
