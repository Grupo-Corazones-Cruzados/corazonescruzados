import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/client/paquete-solicitudes/[id]/asignaciones/[asignacionId] - Asignacion with avances
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; asignacionId: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { asignacionId } = await params;
    const asigId = parseInt(asignacionId);

    if (isNaN(asigId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Get asignacion verifying client ownership
    const asignacionResult = await query(
      `SELECT pa.*,
        json_build_object(
          'id', m.id,
          'nombre', m.nombre,
          'foto', COALESCE(m.foto, up_m.avatar_url),
          'puesto', m.puesto
        ) as miembro,
        json_build_object(
          'id', ps.id,
          'horas_totales', ps.horas_totales,
          'estado', ps.estado,
          'costo_hora', ps.costo_hora,
          'descuento', ps.descuento
        ) as solicitud
      FROM paquete_asignaciones pa
      JOIN paquete_solicitudes ps ON pa.id_solicitud = ps.id
      JOIN miembros m ON pa.id_miembro = m.id
      LEFT JOIN user_profiles up_m ON up_m.id_miembro = m.id
      WHERE pa.id = $1 AND ps.id_cliente = $2`,
      [asigId, tokenData.userId]
    );

    if (asignacionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Asignacion no encontrada" },
        { status: 404 }
      );
    }

    // Get avances
    const avancesResult = await query(
      `SELECT pav.*,
        COALESCE(up.nombre || ' ' || COALESCE(up.apellido, ''), up.email) as autor_nombre,
        CASE
          WHEN pav.autor_tipo = 'miembro' THEN COALESCE(m.foto, up.avatar_url)
          ELSE NULL
        END as autor_foto
      FROM paquete_avances pav
      LEFT JOIN user_profiles up ON pav.id_autor = up.id
      LEFT JOIN miembros m ON up.id_miembro = m.id
      WHERE pav.id_asignacion = $1
      ORDER BY pav.created_at ASC`,
      [asigId]
    );

    return NextResponse.json({
      asignacion: asignacionResult.rows[0],
      avances: avancesResult.rows,
    });
  } catch (error) {
    console.error("Error fetching asignacion detail:", error);
    return NextResponse.json(
      { error: "Error al cargar la asignacion" },
      { status: 500 }
    );
  }
}
