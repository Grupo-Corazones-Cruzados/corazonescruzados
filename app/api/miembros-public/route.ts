import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/miembros-public - List all members (public)
export async function GET() {
  try {
    const result = await query(
      `SELECT m.id, m.nombre, m.puesto, m.descripcion,
              COALESCE(m.foto, up.avatar_url) AS foto,
              m.correo, m.id_fuente, m.costo, m.cod_usuario
       FROM miembros m
       LEFT JOIN user_profiles up ON up.id_miembro = m.id
       ORDER BY m.created_at ASC`
    );

    return NextResponse.json({ members: result.rows });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Error al cargar los miembros" }, { status: 500 });
  }
}
