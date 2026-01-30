import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/clients/search - Search clients by name or email
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Only members and admins can search clients
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || (userResult.rows[0].rol !== "miembro" && userResult.rows[0].rol !== "admin")) {
      return NextResponse.json({ error: "No tienes permiso para buscar clientes" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q");

    if (!searchQuery || searchQuery.trim().length < 2) {
      return NextResponse.json({ clients: [] });
    }

    const searchTerm = `%${searchQuery.trim()}%`;

    // Search by name or email
    const result = await query(
      `SELECT id, nombre, correo_electronico
       FROM clientes
       WHERE nombre ILIKE $1 OR correo_electronico ILIKE $1
       ORDER BY nombre ASC
       LIMIT 20`,
      [searchTerm]
    );

    return NextResponse.json({ clients: result.rows });
  } catch (error) {
    console.error("Error searching clients:", error);
    return NextResponse.json({ error: "Error al buscar clientes" }, { status: 500 });
  }
}
