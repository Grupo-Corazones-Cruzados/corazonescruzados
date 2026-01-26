import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/members/[id]/availability/exceptions - Get availability exceptions
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const miembroId = parseInt(id);

    const today = new Date();
    const result = await query(
      `SELECT * FROM availability_exceptions
       WHERE id_miembro = $1 AND fecha >= $2
       ORDER BY fecha ASC`,
      [miembroId, today.toISOString().split("T")[0]]
    );

    return NextResponse.json({ exceptions: result.rows });
  } catch (error) {
    console.error("Error fetching exceptions:", error);
    return NextResponse.json({ error: "Error al cargar las excepciones" }, { status: 500 });
  }
}

// POST /api/members/[id]/availability/exceptions - Add an exception
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const miembroId = parseInt(id);
    const body = await request.json();
    const { fecha, tipo, motivo, hora_inicio, hora_fin } = body;

    if (!fecha || !tipo) {
      return NextResponse.json(
        { error: "Fecha y tipo son requeridos" },
        { status: 400 }
      );
    }

    // Verify user has permission
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { rol, id_miembro } = userResult.rows[0];
    if (rol !== "admin" && id_miembro !== miembroId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await query(
      `INSERT INTO availability_exceptions (id_miembro, fecha, tipo, motivo, hora_inicio, hora_fin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [miembroId, fecha, tipo, motivo || null, hora_inicio || null, hora_fin || null]
    );

    return NextResponse.json({ exception: result.rows[0] });
  } catch (error) {
    console.error("Error creating exception:", error);
    return NextResponse.json({ error: "Error al crear la excepción" }, { status: 500 });
  }
}
