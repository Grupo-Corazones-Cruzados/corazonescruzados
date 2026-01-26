import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/my-client - Get or create the current user's client record
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get user profile
    const userResult = await query(
      "SELECT nombre, apellido, email FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { nombre, apellido, email } = userResult.rows[0];

    // Check if client exists
    const existingClient = await query(
      "SELECT id FROM clientes WHERE correo_electronico = $1",
      [email]
    );

    if (existingClient.rows.length > 0) {
      return NextResponse.json({ clientId: existingClient.rows[0].id });
    }

    // Create client record
    const fullName = `${nombre || ""} ${apellido || ""}`.trim() || "Cliente";
    const newClient = await query(
      `INSERT INTO clientes (nombre, correo_electronico)
       VALUES ($1, $2)
       RETURNING id`,
      [fullName, email]
    );

    return NextResponse.json({ clientId: newClient.rows[0].id });
  } catch (error) {
    console.error("Error getting/creating client:", error);
    return NextResponse.json({ error: "Error al obtener cliente" }, { status: 500 });
  }
}
