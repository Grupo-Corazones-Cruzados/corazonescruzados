import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/member/paquete-asignaciones - List member's asignaciones with stats
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get member ID
    const userResult = await query(
      "SELECT id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].id_miembro) {
      return NextResponse.json(
        { error: "No eres un miembro" },
        { status: 403 }
      );
    }

    const idMiembro = userResult.rows[0].id_miembro;

    const asignacionesResult = await query(
      `SELECT
        pa.*,
        json_build_object(
          'id', ps.id,
          'horas_totales', ps.horas_totales,
          'estado', ps.estado,
          'costo_hora', ps.costo_hora,
          'descuento', ps.descuento,
          'notas_cliente', ps.notas_cliente
        ) as solicitud,
        json_build_object(
          'id', up.id,
          'nombre', COALESCE(up.nombre || ' ' || COALESCE(up.apellido, ''), up.email),
          'correo_electronico', up.email
        ) as cliente
      FROM paquete_asignaciones pa
      JOIN paquete_solicitudes ps ON pa.id_solicitud = ps.id
      JOIN user_profiles up ON ps.id_cliente = up.id
      WHERE pa.id_miembro = $1
      ORDER BY pa.created_at DESC`,
      [idMiembro]
    );

    const asignaciones = asignacionesResult.rows;

    const stats = {
      total: asignaciones.length,
      pendientes: asignaciones.filter((a: any) => a.estado === "pendiente").length,
      en_progreso: asignaciones.filter((a: any) => ["aprobado", "en_progreso"].includes(a.estado)).length,
      completados: asignaciones.filter((a: any) => ["pre_confirmado", "completado"].includes(a.estado)).length,
    };

    return NextResponse.json({ asignaciones, stats });
  } catch (error) {
    console.error("Error fetching asignaciones:", error);
    return NextResponse.json(
      { error: "Error al cargar las asignaciones" },
      { status: 500 }
    );
  }
}
