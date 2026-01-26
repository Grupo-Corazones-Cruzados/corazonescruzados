import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/members - List all members
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await query(
      `SELECT id, nombre, foto, puesto, costo, correo, activo
       FROM miembros
       WHERE activo = true
       ORDER BY nombre ASC`
    );

    return NextResponse.json({ members: result.rows });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Error al cargar los miembros" }, { status: 500 });
  }
}
