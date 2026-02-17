import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/client/paquete-solicitudes/[id]/asignaciones/[asignacionId]/confirmar
// Client confirms completion of a pre-confirmed assignment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; asignacionId: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id, asignacionId } = await params;
    const solicitudId = parseInt(id);
    const asigId = parseInt(asignacionId);

    if (isNaN(solicitudId) || isNaN(asigId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Verify ownership and state
    const asignacionResult = await query(
      `SELECT pa.*, ps.id_cliente
       FROM paquete_asignaciones pa
       JOIN paquete_solicitudes ps ON pa.id_solicitud = ps.id
       WHERE pa.id = $1 AND pa.id_solicitud = $2 AND ps.id_cliente = $3`,
      [asigId, solicitudId, tokenData.userId]
    );

    if (asignacionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Asignacion no encontrada" },
        { status: 404 }
      );
    }

    const asignacion = asignacionResult.rows[0];

    if (asignacion.estado !== "pre_confirmado") {
      return NextResponse.json(
        { error: "Solo se pueden confirmar asignaciones pre-confirmadas" },
        { status: 400 }
      );
    }

    // Update asignacion to completado
    await query(
      `UPDATE paquete_asignaciones
       SET estado = 'completado', fecha_completado = NOW()
       WHERE id = $1`,
      [asigId]
    );

    // Check if all asignaciones are completed/rechazado
    const pendingResult = await query(
      `SELECT COUNT(*) as pending
       FROM paquete_asignaciones
       WHERE id_solicitud = $1 AND estado NOT IN ('completado', 'rechazado')`,
      [solicitudId]
    );

    if (parseInt(pendingResult.rows[0].pending) === 0) {
      // All asignaciones are done - check if all hours are assigned
      const hoursResult = await query(
        `SELECT ps.horas_totales, COALESCE(SUM(pa.horas_asignadas), 0) as horas_asignadas
         FROM paquete_solicitudes ps
         LEFT JOIN paquete_asignaciones pa ON pa.id_solicitud = ps.id AND pa.estado != 'rechazado'
         WHERE ps.id = $1
         GROUP BY ps.horas_totales`,
        [solicitudId]
      );

      const horasTotales = Number(hoursResult.rows[0].horas_totales);
      const horasAsignadas = Number(hoursResult.rows[0].horas_asignadas);

      if (horasAsignadas >= horasTotales) {
        // All hours assigned and all work done → complete
        await query(
          `UPDATE paquete_solicitudes
           SET estado = 'completado', fecha_completado = NOW()
           WHERE id = $1`,
          [solicitudId]
        );
      } else {
        // Hours remaining to assign → keep en_progreso
        await query(
          `UPDATE paquete_solicitudes
           SET estado = 'en_progreso'
           WHERE id = $1`,
          [solicitudId]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error confirming completion:", error);
    return NextResponse.json(
      { error: "Error al confirmar completación" },
      { status: 500 }
    );
  }
}
