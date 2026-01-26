import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/modulos - List all active modules
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await query(
      `SELECT id, nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos
       FROM modulos
       WHERE activo = true
       ORDER BY orden ASC`
    );

    return NextResponse.json({ modulos: result.rows });
  } catch (error) {
    console.error("Error fetching modulos:", error);
    return NextResponse.json({ error: "Error al cargar los módulos" }, { status: 500 });
  }
}
