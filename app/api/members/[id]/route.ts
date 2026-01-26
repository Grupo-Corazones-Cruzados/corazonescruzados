import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/members/[id] - Get a specific member
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const memberId = params.id;

    const result = await query(
      `SELECT
        id, nombre, puesto, descripcion, foto, correo, celular, costo, cod_usuario
      FROM miembros
      WHERE id = $1`,
      [memberId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ member: result.rows[0] });
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json({ error: "Error al obtener miembro" }, { status: 500 });
  }
}
