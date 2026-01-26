import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/faq - List all FAQ questions (public)
export async function GET() {
  try {
    const result = await query(
      `SELECT id, pregunta, respuesta, video_url
       FROM preguntas_frecuentes
       ORDER BY id ASC`
    );

    return NextResponse.json({ preguntas: result.rows });
  } catch (error) {
    console.error("Error fetching FAQ:", error);
    return NextResponse.json({ error: "Error al cargar las preguntas frecuentes" }, { status: 500 });
  }
}
