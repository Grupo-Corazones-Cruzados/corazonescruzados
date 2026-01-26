import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/actions - List all available actions/services
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await query(
      `SELECT id, nombre, descripcion, precio_base, activo
       FROM acciones
       WHERE activo = true
       ORDER BY nombre ASC`
    );

    return NextResponse.json({ actions: result.rows });
  } catch (error) {
    console.error("Error fetching actions:", error);
    return NextResponse.json({ error: "Error al cargar las acciones" }, { status: 500 });
  }
}
