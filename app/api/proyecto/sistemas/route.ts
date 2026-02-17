import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [pasosResult, pisosResult, sistemasResult] = await Promise.all([
      query("SELECT id, nombre, secuencia FROM pasos ORDER BY secuencia ASC, id ASC"),
      query("SELECT id, nombre, secuencia FROM pisos ORDER BY secuencia ASC, id ASC"),
      query("SELECT id, nombre, id_paso, id_piso, secuencia, descripcion, icono, ruta FROM sistemas ORDER BY secuencia ASC, id ASC"),
    ]);

    return NextResponse.json({
      pasos: pasosResult.rows,
      pisos: pisosResult.rows,
      sistemas: sistemasResult.rows,
    });
  } catch (error) {
    console.error("Error fetching sistemas data:", error);
    return NextResponse.json(
      { error: "Error al cargar datos" },
      { status: 500 }
    );
  }
}
