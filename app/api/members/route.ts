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
      `SELECT m.id, m.nombre, COALESCE(m.foto, up.avatar_url) AS foto,
              m.puesto, m.costo, m.correo
       FROM miembros m
       LEFT JOIN user_profiles up ON up.id_miembro = m.id
       ORDER BY m.nombre ASC`
    );

    return NextResponse.json({ members: result.rows });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json({ error: "Error al cargar los miembros" }, { status: 500 });
  }
}
