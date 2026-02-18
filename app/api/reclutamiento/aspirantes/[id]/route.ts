import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess, CRITERIOS_ENCUADRE } from "@/lib/reclutamiento";

// GET /api/reclutamiento/aspirantes/[id] - Aspirant profile with aggregated scores
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

    // Get postulación with user info
    const postResult = await query(
      `SELECT p.id, p.created_at, p.motivo, p.id_usuario,
              up.nombre, up.apellido, up.email, up.avatar_url, up.telefono
       FROM postulaciones p
       JOIN user_profiles up ON p.id_usuario = up.id
       WHERE p.id = $1`,
      [id]
    );

    if (postResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Aspirante no encontrado" },
        { status: 404 }
      );
    }

    const aspirante = postResult.rows[0];

    // Get aggregated scores
    const scoreAggs = CRITERIOS_ENCUADRE.map(
      (c) => `MAX(ep.${c}) as max_${c}, MIN(ep.${c}) as min_${c}, ROUND(AVG(ep.${c})::numeric, 1) as avg_${c}`
    ).join(", ");

    const scoresResult = await query(
      `SELECT ${scoreAggs}, COUNT(ep.id) as total_evaluaciones
       FROM evento_puntuaciones ep
       JOIN evento_invitaciones ei ON ep.id_invitacion = ei.id
       WHERE ei.id_postulacion = $1`,
      [id]
    );

    // Get event history
    const eventsResult = await query(
      `SELECT e.id, e.nombre, e.fecha, e.estado as evento_estado,
              ei.participo, ei.created_at as fecha_invitacion
       FROM evento_invitaciones ei
       JOIN eventos_reclutamiento e ON ei.id_evento = e.id
       WHERE ei.id_postulacion = $1
       ORDER BY e.fecha DESC`,
      [id]
    );

    // Get active restrictions
    const restrictionResult = await query(
      `SELECT r.*, up.nombre as restringido_por_nombre, up.apellido as restringido_por_apellido
       FROM restricciones_reclutamiento r
       JOIN user_profiles up ON r.restringido_por = up.id
       WHERE r.id_postulacion = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    return NextResponse.json({
      aspirante,
      puntuaciones: scoresResult.rows[0],
      eventos: eventsResult.rows,
      restricciones: restrictionResult.rows,
    });
  } catch (error) {
    console.error("Error fetching aspirante:", error);
    return NextResponse.json(
      { error: "Error al cargar aspirante" },
      { status: 500 }
    );
  }
}
