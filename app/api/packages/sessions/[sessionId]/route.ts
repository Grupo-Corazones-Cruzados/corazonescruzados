import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import {
  sendSessionCompletedToClient,
  sendDateChangeRequestToClient,
} from "@/lib/email";

// PATCH /api/packages/sessions/[sessionId] - Update session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { sessionId } = await params;
    const sessionIdNum = parseInt(sessionId);
    const body = await request.json();

    if (isNaN(sessionIdNum)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Get session with purchase and user info
    const sessionResult = await query(
      `SELECT ps.*,
              pp.id_cliente, pp.id_miembro, pp.horas_totales, pp.horas_consumidas,
              COALESCE(up_client.nombre || ' ' || COALESCE(up_client.apellido, ''), up_client.email) as cliente_nombre,
              up_client.email as cliente_email,
              up_member.id_miembro as user_member_id,
              m.nombre as miembro_nombre,
              p.nombre as paquete_nombre
       FROM package_sessions ps
       JOIN package_purchases pp ON ps.id_purchase = pp.id
       JOIN user_profiles up_client ON pp.id_cliente = up_client.id
       JOIN miembros m ON pp.id_miembro = m.id
       JOIN user_profiles up_member ON up_member.id = $2
       JOIN paquetes p ON pp.id_paquete = p.id
       WHERE ps.id = $1`,
      [sessionIdNum, tokenData.userId]
    );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Sesion no encontrada" },
        { status: 404 }
      );
    }

    const session = sessionResult.rows[0];
    const isClient = session.id_cliente === tokenData.userId;
    const isMember = session.user_member_id === session.id_miembro;

    if (!isClient && !isMember) {
      return NextResponse.json(
        { error: "No tienes acceso a esta sesion" },
        { status: 403 }
      );
    }

    const { action, notas, motivo_cambio, nueva_fecha, nueva_hora } = body;

    // Member actions
    if (isMember) {
      if (action === "complete") {
        // Mark session as completed
        if (session.estado !== "programada") {
          return NextResponse.json(
            { error: "Solo puedes completar sesiones programadas" },
            { status: 400 }
          );
        }

        await query(
          `UPDATE package_sessions
           SET estado = 'completada', fecha_completada = NOW(), notas_miembro = $1
           WHERE id = $2`,
          [notas || null, sessionIdNum]
        );

        // Calculate remaining hours
        const horasRestantes =
          Number(session.horas_totales) -
          Number(session.horas_consumidas) -
          Number(session.duracion_horas);

        // Send email to client
        await sendSessionCompletedToClient(
          session.cliente_email,
          session.cliente_nombre,
          {
            id: session.id,
            fecha: session.fecha,
            duracion_horas: session.duracion_horas,
          },
          session.miembro_nombre,
          session.paquete_nombre,
          horasRestantes,
          notas
        );

        return NextResponse.json({ success: true, estado: "completada" });
      }

      if (action === "request_change") {
        // Request date change
        if (session.estado !== "programada") {
          return NextResponse.json(
            { error: "Solo puedes solicitar cambio en sesiones programadas" },
            { status: 400 }
          );
        }

        if (!motivo_cambio || !nueva_fecha || !nueva_hora) {
          return NextResponse.json(
            { error: "Motivo, nueva fecha y nueva hora son requeridos" },
            { status: 400 }
          );
        }

        await query(
          `UPDATE package_sessions
           SET cambio_solicitado = true,
               motivo_cambio = $1,
               nueva_fecha_propuesta = $2,
               nueva_hora_propuesta = $3
           WHERE id = $4`,
          [motivo_cambio, nueva_fecha, nueva_hora, sessionIdNum]
        );

        // Send email to client
        await sendDateChangeRequestToClient(
          session.cliente_email,
          session.cliente_nombre,
          {
            id: session.id,
            fecha_original: session.fecha,
            hora_original: session.hora_inicio,
            nueva_fecha,
            nueva_hora,
          },
          session.miembro_nombre,
          session.paquete_nombre,
          motivo_cambio
        );

        return NextResponse.json({ success: true, cambio_solicitado: true });
      }

      if (action === "no_show") {
        // Mark as no-show
        if (session.estado !== "programada") {
          return NextResponse.json(
            { error: "Solo puedes marcar como no asistio sesiones programadas" },
            { status: 400 }
          );
        }

        await query(
          `UPDATE package_sessions SET estado = 'no_asistio', notas_miembro = $1 WHERE id = $2`,
          [notas || null, sessionIdNum]
        );

        return NextResponse.json({ success: true, estado: "no_asistio" });
      }
    }

    // Client actions
    if (isClient) {
      if (action === "accept_change") {
        // Accept date change proposed by member
        if (!session.cambio_solicitado) {
          return NextResponse.json(
            { error: "No hay cambio pendiente para aceptar" },
            { status: 400 }
          );
        }

        // Calculate new duration
        const [startHour, startMin] = session.nueva_hora_propuesta.split(":").map(Number);
        const [endHour, endMin] = session.hora_fin.split(":").map(Number);
        const newDuration = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;

        await query(
          `UPDATE package_sessions
           SET fecha = $1,
               hora_inicio = $2,
               cambio_solicitado = false,
               motivo_cambio = NULL,
               nueva_fecha_propuesta = NULL,
               nueva_hora_propuesta = NULL,
               estado = 'programada'
           WHERE id = $3`,
          [session.nueva_fecha_propuesta, session.nueva_hora_propuesta, sessionIdNum]
        );

        return NextResponse.json({ success: true, cambio_aceptado: true });
      }

      if (action === "reject_change") {
        // Reject date change - keep original
        await query(
          `UPDATE package_sessions
           SET cambio_solicitado = false,
               motivo_cambio = NULL,
               nueva_fecha_propuesta = NULL,
               nueva_hora_propuesta = NULL
           WHERE id = $1`,
          [sessionIdNum]
        );

        return NextResponse.json({ success: true, cambio_rechazado: true });
      }

      if (action === "cancel") {
        // Cancel session
        if (session.estado !== "programada") {
          return NextResponse.json(
            { error: "Solo puedes cancelar sesiones programadas" },
            { status: 400 }
          );
        }

        await query(
          `UPDATE package_sessions SET estado = 'cancelada', notas_cliente = $1 WHERE id = $2`,
          [notas || null, sessionIdNum]
        );

        return NextResponse.json({ success: true, estado: "cancelada" });
      }
    }

    return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Error al actualizar la sesion" },
      { status: 500 }
    );
  }
}

// DELETE /api/packages/sessions/[sessionId] - Delete/cancel session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { sessionId } = await params;
    const sessionIdNum = parseInt(sessionId);

    if (isNaN(sessionIdNum)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Verify ownership (client can cancel their sessions)
    const sessionResult = await query(
      `SELECT ps.*, pp.id_cliente
       FROM package_sessions ps
       JOIN package_purchases pp ON ps.id_purchase = pp.id
       WHERE ps.id = $1 AND pp.id_cliente = $2`,
      [sessionIdNum, tokenData.userId]
    );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Sesion no encontrada" },
        { status: 404 }
      );
    }

    const session = sessionResult.rows[0];

    if (session.estado !== "programada") {
      return NextResponse.json(
        { error: "Solo puedes cancelar sesiones programadas" },
        { status: 400 }
      );
    }

    await query(
      `UPDATE package_sessions SET estado = 'cancelada' WHERE id = $1`,
      [sessionIdNum]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling session:", error);
    return NextResponse.json(
      { error: "Error al cancelar la sesion" },
      { status: 500 }
    );
  }
}
