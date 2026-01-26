import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/clients - List all clients
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user has permission (admin or miembro)
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { rol } = userResult.rows[0];
    if (rol !== "admin" && rol !== "miembro") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await query(
      `SELECT id, nombre, correo_electronico, telefono, empresa
       FROM clientes
       ORDER BY nombre ASC`
    );

    return NextResponse.json({ clients: result.rows });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Error al cargar los clientes" }, { status: 500 });
  }
}
