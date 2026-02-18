import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess, CRITERIOS_ENCUADRE } from "@/lib/reclutamiento";

// GET /api/reclutamiento/eventos/[id]/puntuaciones - Get scores for event
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    const result = await query(
      `SELECT ep.*,
              up.nombre as evaluador_nombre, up.apellido as evaluador_apellido,
              ei.id_postulacion,
              asp.nombre as aspirante_nombre, asp.apellido as aspirante_apellido
       FROM evento_puntuaciones ep
       JOIN evento_invitaciones ei ON ep.id_invitacion = ei.id
       JOIN user_profiles up ON ep.evaluado_por = up.id
       JOIN postulaciones p ON ei.id_postulacion = p.id
       JOIN user_profiles asp ON p.id_usuario = asp.id
       WHERE ei.id_evento = $1
       ORDER BY ep.created_at DESC`,
      [id]
    );

    return NextResponse.json({ puntuaciones: result.rows });
  } catch (error) {
    console.error("Error fetching puntuaciones:", error);
    return NextResponse.json(
      { error: "Error al cargar puntuaciones" },
      { status: 500 }
    );
  }
}

// PATCH /api/reclutamiento/eventos/[id]/puntuaciones - Upsert score
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { id_invitacion } = body;

    if (!id_invitacion) {
      return NextResponse.json(
        { error: "ID de invitación requerido" },
        { status: 400 }
      );
    }

    // Verify the invitation belongs to this event
    const invResult = await query(
      `SELECT id FROM evento_invitaciones WHERE id = $1 AND id_evento = $2`,
      [id_invitacion, id]
    );
    if (invResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Invitación no encontrada en este evento" },
        { status: 404 }
      );
    }

    // Validate criteria values
    const scores: Record<string, number> = {};
    for (const criterio of CRITERIOS_ENCUADRE) {
      if (body[criterio] !== undefined) {
        const val = Number(body[criterio]);
        if (isNaN(val) || val < 1 || val > 10) {
          return NextResponse.json(
            { error: `${criterio} debe ser un número entre 1 y 10` },
            { status: 400 }
          );
        }
        scores[criterio] = val;
      }
    }

    if (Object.keys(scores).length === 0) {
      return NextResponse.json(
        { error: "Al menos un criterio es requerido" },
        { status: 400 }
      );
    }

    // Upsert the score
    const criterioColumns = CRITERIOS_ENCUADRE.join(", ");
    const criterioValues = CRITERIOS_ENCUADRE.map((c) => scores[c] ?? null);
    const criterioPlaceholders = CRITERIOS_ENCUADRE.map((_, i) => `$${i + 3}`).join(", ");
    const criterioUpdates = CRITERIOS_ENCUADRE.map(
      (c, i) => `${c} = COALESCE($${i + 3}, ${c})`
    ).join(", ");

    const result = await query(
      `INSERT INTO evento_puntuaciones (id_invitacion, evaluado_por, ${criterioColumns})
       VALUES ($1, $2, ${criterioPlaceholders})
       ON CONFLICT (id_invitacion, evaluado_por) DO UPDATE SET ${criterioUpdates}
       RETURNING *`,
      [id_invitacion, tokenData.userId, ...criterioValues]
    );

    return NextResponse.json({ puntuacion: result.rows[0] });
  } catch (error) {
    console.error("Error upserting puntuación:", error);
    return NextResponse.json(
      { error: "Error al guardar puntuación" },
      { status: 500 }
    );
  }
}
