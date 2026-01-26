import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/actions - List actions, optionally filtered by member
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const miembroId = searchParams.get("miembro");

    let sql = `SELECT id, nombre, id_miembro, id_fuente FROM acciones`;
    const params: any[] = [];

    if (miembroId) {
      sql += ` WHERE id_miembro = $1`;
      params.push(parseInt(miembroId));
    }

    sql += ` ORDER BY nombre ASC`;

    const result = await query(sql, params);

    return NextResponse.json({ actions: result.rows });
  } catch (error) {
    console.error("Error fetching actions:", error);
    return NextResponse.json({ error: "Error al cargar las acciones" }, { status: 500 });
  }
}
