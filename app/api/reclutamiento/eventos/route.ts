import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess } from "@/lib/reclutamiento";

// GET /api/reclutamiento/eventos - List eventos
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await query(
      `SELECT e.*,
              up.nombre as creador_nombre, up.apellido as creador_apellido,
              (SELECT COUNT(*) FROM evento_invitaciones ei WHERE ei.id_evento = e.id) as total_invitados,
              (SELECT COUNT(*) FROM evento_invitaciones ei WHERE ei.id_evento = e.id AND ei.participo = TRUE) as total_participaron
       FROM eventos_reclutamiento e
       JOIN user_profiles up ON e.id_creador = up.id
       ORDER BY e.fecha DESC`
    );

    return NextResponse.json({ eventos: result.rows });
  } catch (error) {
    console.error("Error fetching eventos:", error);
    return NextResponse.json(
      { error: "Error al cargar eventos" },
      { status: 500 }
    );
  }
}

// POST /api/reclutamiento/eventos - Create evento
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, descripcion, fecha } = body;

    if (!nombre || !fecha) {
      return NextResponse.json(
        { error: "Nombre y fecha son requeridos" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO eventos_reclutamiento (nombre, descripcion, fecha, id_creador)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, descripcion || null, fecha, tokenData.userId]
    );

    return NextResponse.json({ evento: result.rows[0] });
  } catch (error) {
    console.error("Error creating evento:", error);
    return NextResponse.json(
      { error: "Error al crear evento" },
      { status: 500 }
    );
  }
}
