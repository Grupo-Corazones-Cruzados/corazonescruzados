import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// POST /api/aspirantes - Create an aspiring member record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { motivo } = body;

    if (!motivo || !motivo.trim()) {
      return NextResponse.json(
        { error: "El motivo es requerido" },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO aspirantes (motivo) VALUES ($1)`,
      [motivo.trim()]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating aspirante:", error);
    return NextResponse.json({ error: "Error al enviar" }, { status: 500 });
  }
}
