import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/miembros-public - List all members (public)
export async function GET() {
  try {
    const result = await query(
      `SELECT id, nombre, puesto, descripcion, foto, correo, id_fuente, costo, cod_usuario
       FROM miembros
       WHERE activo = true
       ORDER BY created_at ASC`
    );

    return NextResponse.json({ members: result.rows });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Error al cargar los miembros" }, { status: 500 });
  }
}
