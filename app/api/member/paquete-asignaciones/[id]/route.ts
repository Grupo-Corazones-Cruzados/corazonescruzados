import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/member/paquete-asignaciones/[id] - Detail with avances, solicitud, cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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
    const { id } = await params;
    const asigId = parseInt(id);

    if (isNaN(asigId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const asignacionResult = await query(
      `SELECT pa.*,
        json_build_object(
          'id', ps.id,
          'horas_totales', ps.horas_totales,
          'horas_asignadas', ps.horas_asignadas,
          'estado', ps.estado,
          'costo_hora', ps.costo_hora,
          'descuento', ps.descuento,
          'notas_cliente', ps.notas_cliente,
          'created_at', ps.created_at
        ) as solicitud,
        json_build_object(
          'id', up.id,
          'nombre', COALESCE(up.nombre || ' ' || COALESCE(up.apellido, ''), up.email),
          'correo_electronico', up.email
        ) as cliente
      FROM paquete_asignaciones pa
      JOIN paquete_solicitudes ps ON pa.id_solicitud = ps.id
      JOIN user_profiles up ON ps.id_cliente = up.id
      WHERE pa.id = $1 AND pa.id_miembro = $2`,
      [asigId, idMiembro]
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
          WHEN pav.autor_tipo = 'miembro' THEN m.foto
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

// PATCH /api/member/paquete-asignaciones/[id] - Respond (approve/reject)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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
    const { id } = await params;
    const asigId = parseInt(id);
    const body = await request.json();
    const { estado, motivo } = body;

    if (isNaN(asigId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    if (!estado || !["aprobado", "rechazado"].includes(estado)) {
      return NextResponse.json(
        { error: "Estado invalido. Debe ser: aprobado o rechazado" },
        { status: 400 }
      );
    }

    // Verify ownership and pending state
    const asignacionResult = await query(
      `SELECT pa.*, pa.id_solicitud
       FROM paquete_asignaciones pa
       WHERE pa.id = $1 AND pa.id_miembro = $2`,
      [asigId, idMiembro]
    );

    if (asignacionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Asignacion no encontrada" },
        { status: 404 }
      );
    }

    const asignacion = asignacionResult.rows[0];

    if (asignacion.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Solo se pueden responder asignaciones pendientes" },
        { status: 400 }
      );
    }

    // Update asignacion
    if (estado === "aprobado") {
      await query(
        `UPDATE paquete_asignaciones
         SET estado = 'aprobado', fecha_respuesta = NOW()
         WHERE id = $1`,
        [asigId]
      );
    } else {
      await query(
        `UPDATE paquete_asignaciones
         SET estado = 'rechazado', fecha_respuesta = NOW(), motivo_rechazo = $2
         WHERE id = $1`,
        [asigId, motivo || null]
      );
    }

    // Update parent solicitud estado based on all asignaciones
    const allAsignaciones = await query(
      `SELECT estado FROM paquete_asignaciones WHERE id_solicitud = $1`,
      [asignacion.id_solicitud]
    );

    const estados = allAsignaciones.rows.map((a: any) => a.estado);
    let nuevoEstadoSolicitud: string;

    if (estados.every((e: string) => e === "rechazado")) {
      nuevoEstadoSolicitud = "cancelado";
    } else if (estados.some((e: string) => ["aprobado", "en_progreso"].includes(e)) && estados.some((e: string) => e === "pendiente")) {
      nuevoEstadoSolicitud = "parcial";
    } else if (estados.every((e: string) => ["aprobado", "en_progreso", "pre_confirmado", "completado", "rechazado"].includes(e))) {
      const hasActive = estados.some((e: string) => ["aprobado", "en_progreso", "pre_confirmado"].includes(e));
      nuevoEstadoSolicitud = hasActive ? "en_progreso" : "completado";
    } else {
      nuevoEstadoSolicitud = "pendiente";
    }

    await query(
      `UPDATE paquete_solicitudes SET estado = $1 WHERE id = $2`,
      [nuevoEstadoSolicitud, asignacion.id_solicitud]
    );

    return NextResponse.json({ success: true, estado });
  } catch (error) {
    console.error("Error updating asignacion:", error);
    return NextResponse.json(
      { error: "Error al actualizar la asignacion" },
      { status: 500 }
    );
  }
}
