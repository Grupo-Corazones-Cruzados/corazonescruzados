import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/paquetes - List all packages (public)
export async function GET() {
  try {
    const result = await query(
      `SELECT id, nombre, contenido, horas, descripcion, descuento
       FROM paquetes
       ORDER BY created_at ASC`
    );

    return NextResponse.json({ paquetes: result.rows });
  } catch (error) {
    console.error("Error fetching paquetes:", error);
    return NextResponse.json({ error: "Error al cargar los paquetes" }, { status: 500 });
  }
}
