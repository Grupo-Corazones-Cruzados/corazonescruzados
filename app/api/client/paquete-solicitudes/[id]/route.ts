import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/client/paquete-solicitudes/[id] - Detail with asignaciones + avance counts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id);

    if (isNaN(solicitudId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Get solicitud
    const solicitudResult = await query(
      `SELECT ps.*, p.nombre as tier_nombre
       FROM paquete_solicitudes ps
       LEFT JOIN paquetes p ON ps.id_paquete_tier = p.id
       WHERE ps.id = $1 AND ps.id_cliente = $2`,
      [solicitudId, tokenData.userId]
    );

    if (solicitudResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    const solicitud = solicitudResult.rows[0];

    // Get asignaciones with miembro info and avance count
    const asignacionesResult = await query(
      `SELECT
        pa.*,
        json_build_object(
          'id', m.id,
          'nombre', m.nombre,
          'foto', COALESCE(m.foto, up.avatar_url),
          'puesto', m.puesto
        ) as miembro,
        COALESCE((SELECT COUNT(*) FROM paquete_avances pav WHERE pav.id_asignacion = pa.id), 0) as avances_count
      FROM paquete_asignaciones pa
      JOIN miembros m ON pa.id_miembro = m.id
      LEFT JOIN user_profiles up ON up.id_miembro = m.id
      WHERE pa.id_solicitud = $1
      ORDER BY pa.created_at ASC`,
      [solicitudId]
    );

    return NextResponse.json({
      solicitud,
      asignaciones: asignacionesResult.rows,
    });
  } catch (error) {
    console.error("Error fetching solicitud detail:", error);
    return NextResponse.json(
      { error: "Error al cargar el detalle de la solicitud" },
      { status: 500 }
    );
  }
}
