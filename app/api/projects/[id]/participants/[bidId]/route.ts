import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import { sendParticipantRemovedEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string; bidId: string }> };

// DELETE - Remover participante del proyecto
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id, bidId } = await context.params;
    const body = await request.json();
    const { motivo } = body;

    if (!motivo || motivo.trim().length < 10) {
      return NextResponse.json(
        { error: "Motivo de remocion requerido (minimo 10 caracteres)" },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const projectResult = await query(
      `SELECT id, id_cliente, id_miembro_propietario, titulo, estado
       FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar permisos (solo el propietario puede remover participantes)
    const isClientOwner = tokenData.role === "cliente" && project.id_cliente === tokenData.id;
    const isMemberOwner = tokenData.role === "miembro" && project.id_miembro_propietario === tokenData.id;
    const isAdmin = tokenData.role === "admin";

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Verificar que el bid existe y está aceptado
    const bidResult = await query(
      `SELECT b.*, m.nombre as miembro_nombre, m.email as miembro_email
       FROM project_bids b
       JOIN miembros m ON b.id_miembro = m.id
       WHERE b.id = $1 AND b.id_project = $2`,
      [bidId, id]
    );

    if (bidResult.rows.length === 0) {
      return NextResponse.json({ error: "Participante no encontrado" }, { status: 404 });
    }

    const bid = bidResult.rows[0];

    if (bid.estado !== "aceptada") {
      return NextResponse.json(
        { error: "Solo se pueden remover participantes con bid aceptada" },
        { status: 400 }
      );
    }

    if (bid.removido) {
      return NextResponse.json(
        { error: "El participante ya fue removido" },
        { status: 400 }
      );
    }

    // Marcar bid como removido
    await query(
      `UPDATE project_bids
       SET removido = TRUE,
           fecha_remocion = NOW(),
           motivo_remocion = $1,
           removido_por_id = $2
       WHERE id = $3`,
      [motivo.trim(), tokenData.id, bidId]
    );

    // Obtener nombre del que remueve
    let removidoPorNombre = "El propietario del proyecto";
    if (isMemberOwner) {
      const memberResult = await query(
        `SELECT nombre FROM miembros WHERE id = $1`,
        [tokenData.id]
      );
      if (memberResult.rows.length > 0) {
        removidoPorNombre = memberResult.rows[0].nombre;
      }
    } else if (isClientOwner) {
      const clientResult = await query(
        `SELECT nombre FROM clientes WHERE id = $1`,
        [tokenData.id]
      );
      if (clientResult.rows.length > 0) {
        removidoPorNombre = clientResult.rows[0].nombre;
      }
    }

    // Enviar email al miembro removido
    if (bid.miembro_email) {
      await sendParticipantRemovedEmail(
        bid.miembro_email,
        bid.miembro_nombre,
        { id: project.id, titulo: project.titulo },
        motivo.trim(),
        removidoPorNombre
      );
    }

    return NextResponse.json({
      message: "Participante removido exitosamente",
      participante: {
        id: bid.id_miembro,
        nombre: bid.miembro_nombre
      }
    });
  } catch (error) {
    console.error("Error removing participant:", error);
    return NextResponse.json(
      { error: "Error al remover participante" },
      { status: 500 }
    );
  }
}
