import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/fuentes - List all fuentes (public)
export async function GET() {
  try {
    const result = await query(
      `SELECT id, nombre FROM fuentes ORDER BY nombre ASC`
    );

    return NextResponse.json({ fuentes: result.rows });
  } catch (error) {
    console.error("Error fetching fuentes:", error);
    return NextResponse.json({ error: "Error al cargar las fuentes" }, { status: 500 });
  }
}
