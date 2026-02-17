import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/client/paquete-solicitudes/[id]/asignaciones - Add new asignacion to existing solicitud
export async function POST(
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
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Verify ownership and that solicitud is not completed/cancelled
    const solicitudResult = await query(
      `SELECT * FROM paquete_solicitudes WHERE id = $1 AND id_cliente = $2`,
      [solicitudId, tokenData.userId]
    );

    if (solicitudResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 }
      );
    }

    const solicitud = solicitudResult.rows[0];

    if (["completado", "cancelado"].includes(solicitud.estado)) {
      return NextResponse.json(
        { error: "No se pueden agregar asignaciones a una solicitud completada o cancelada" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { id_miembro, horas_asignadas, descripcion_tarea, dias_semana } = body;

    if (!id_miembro || !horas_asignadas || horas_asignadas <= 0) {
      return NextResponse.json(
        { error: "Miembro y horas son requeridos" },
        { status: 400 }
      );
    }

    // Check for duplicate member
    const duplicateResult = await query(
      `SELECT id FROM paquete_asignaciones
       WHERE id_solicitud = $1 AND id_miembro = $2 AND estado != 'rechazado'`,
      [solicitudId, id_miembro]
    );

    if (duplicateResult.rows.length > 0) {
      return NextResponse.json(
        { error: "Este miembro ya tiene una asignación activa en esta solicitud" },
        { status: 400 }
      );
    }

    // Check available hours
    const hoursResult = await query(
      `SELECT COALESCE(SUM(horas_asignadas), 0) as total_asignadas
       FROM paquete_asignaciones
       WHERE id_solicitud = $1 AND estado != 'rechazado'`,
      [solicitudId]
    );

    const totalAsignadas = Number(hoursResult.rows[0].total_asignadas);
    const horasDisponibles = Number(solicitud.horas_totales) - totalAsignadas;

    if (horas_asignadas > horasDisponibles) {
      return NextResponse.json(
        { error: `Solo hay ${horasDisponibles}h disponibles` },
        { status: 400 }
      );
    }

    // Create asignacion
    const asignacionResult = await query(
      `INSERT INTO paquete_asignaciones (id_solicitud, id_miembro, horas_asignadas, descripcion_tarea, dias_semana, estado)
       VALUES ($1, $2, $3, $4, $5, 'pendiente')
       RETURNING *`,
      [
        solicitudId,
        id_miembro,
        horas_asignadas,
        descripcion_tarea || null,
        JSON.stringify(dias_semana || []),
      ]
    );

    return NextResponse.json({ asignacion: asignacionResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error adding asignacion:", error);
    return NextResponse.json(
      { error: "Error al agregar la asignación" },
      { status: 500 }
    );
  }
}
