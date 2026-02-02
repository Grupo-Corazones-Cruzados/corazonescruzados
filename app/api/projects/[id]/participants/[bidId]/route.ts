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

    if (!motivo || motivo.trim().length < 5) {
      return NextResponse.json(
        { error: "Motivo de remocion requerido (minimo 5 caracteres)" },
        { status: 400 }
      );
    }

    // Get user profile
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const userRole = userResult.rows[0].rol;
    const userMiembroId = userResult.rows[0].id_miembro;

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

    // Verificar permisos
    // For client owner check, we need to match via email since id_cliente references clientes table
    let isClientOwner = false;
    if (userRole === "cliente" && project.id_cliente) {
      const clientCheck = await query(
        `SELECT c.id FROM clientes c
         JOIN user_profiles up ON LOWER(up.email) = LOWER(c.correo_electronico)
         WHERE up.id = $1 AND c.id = $2`,
        [tokenData.userId, project.id_cliente]
      );
      isClientOwner = clientCheck.rows.length > 0;
    }
    const projectOwnerId = project.id_miembro_propietario ? Number(project.id_miembro_propietario) : null;
    const userMemberId = userMiembroId ? Number(userMiembroId) : null;
    const isMemberOwner = (userRole === "miembro" || userRole === "admin") && projectOwnerId !== null && projectOwnerId === userMemberId;
    const isAdmin = userRole === "admin";

    // Team members can also report other team members
    let canReport = isClientOwner || isMemberOwner || isAdmin;
    if (!canReport && userRole === "miembro" && userMemberId) {
      const teamCheck = await query(
        "SELECT id FROM project_bids WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada' AND (removido IS NULL OR removido = FALSE)",
        [id, userMemberId]
      );
      canReport = teamCheck.rows.length > 0;
    }

    if (!canReport) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Verificar que el bid existe y está aceptado
    const bidResult = await query(
      `SELECT b.*, m.nombre as miembro_nombre, m.correo_electronico as miembro_email
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
      [motivo.trim(), userMiembroId || null, bidId]
    );

    // Obtener nombre del que remueve
    let removidoPorNombre = "El propietario del proyecto";
    if (userMiembroId) {
      const memberResult = await query(
        `SELECT nombre FROM miembros WHERE id = $1`,
        [userMiembroId]
      );
      if (memberResult.rows.length > 0) {
        removidoPorNombre = memberResult.rows[0].nombre;
      }
    } else if (userRole === "cliente") {
      const clientResult = await query(
        `SELECT nombre FROM clientes c
         JOIN user_profiles up ON up.email = c.correo_electronico
         WHERE up.id = $1`,
        [tokenData.userId]
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
