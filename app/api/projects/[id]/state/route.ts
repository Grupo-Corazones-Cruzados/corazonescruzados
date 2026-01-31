import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import {
  isValidStateTransition,
  isTerminalState,
  getStateLabel,
  type ProjectState
} from "@/lib/projectStates";
import { sendProjectStateChangeEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH - Cambiar estado del proyecto manualmente
export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { estado } = body;

    if (!estado) {
      return NextResponse.json(
        { error: "Estado requerido" },
        { status: 400 }
      );
    }

    // Obtener proyecto actual
    const projectResult = await query(
      `SELECT p.*,
              m.nombre as propietario_nombre
       FROM projects p
       LEFT JOIN miembros m ON p.id_miembro_propietario = m.id
       WHERE p.id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];
    const estadoAnterior = project.estado as ProjectState;
    const nuevoEstado = estado as ProjectState;

    // Verificar permisos (solo el propietario puede cambiar estado)
    const isClientOwner = tokenData.role === "cliente" && project.id_cliente === tokenData.id;
    const isMemberOwner = tokenData.role === "miembro" && project.id_miembro_propietario === tokenData.id;
    const isAdmin = tokenData.role === "admin";

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // No se puede cambiar desde un estado terminal
    if (isTerminalState(estadoAnterior) && !isAdmin) {
      return NextResponse.json(
        { error: "No se puede cambiar el estado de un proyecto cerrado" },
        { status: 400 }
      );
    }

    // Determinar si es proyecto privado (sin colaboradores aceptados)
    const bidsResult = await query(
      `SELECT COUNT(*) as count FROM project_bids
       WHERE id_project = $1 AND estado = 'aceptada' AND (removido IS NULL OR removido = FALSE)`,
      [id]
    );
    const hasCollaborators = parseInt(bidsResult.rows[0].count) > 0;
    const isPrivateProject = project.visibilidad === 'privado' && !hasCollaborators;

    // Validar transición de estado
    if (!isAdmin) {
      const isValid = isValidStateTransition(estadoAnterior, nuevoEstado, isPrivateProject);
      if (!isValid) {
        return NextResponse.json(
          {
            error: `Transicion de estado no valida: ${getStateLabel(estadoAnterior)} → ${getStateLabel(nuevoEstado)}`,
            estadoActual: estadoAnterior,
            estadoSolicitado: nuevoEstado
          },
          { status: 400 }
        );
      }
    }

    // Para proyectos colaborativos, verificar que todos hayan terminado antes de completar
    if (nuevoEstado === 'completado' && hasCollaborators) {
      const pendingWorkResult = await query(
        `SELECT COUNT(*) as count FROM project_bids
         WHERE id_project = $1
           AND estado = 'aceptada'
           AND (removido IS NULL OR removido = FALSE)
           AND (trabajo_finalizado IS NULL OR trabajo_finalizado = FALSE)`,
        [id]
      );

      if (parseInt(pendingWorkResult.rows[0].count) > 0) {
        return NextResponse.json(
          { error: "No todos los participantes han marcado su trabajo como finalizado" },
          { status: 400 }
        );
      }
    }

    // Actualizar estado
    await query(
      `UPDATE projects SET estado = $1, updated_at = NOW() WHERE id = $2`,
      [nuevoEstado, id]
    );

    // Enviar email al cliente externo si existe
    if (project.cliente_externo_email && project.cliente_externo_nombre) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      let shareUrl = `${APP_URL}/p/${project.share_token}`;

      // Si no hay share_token, generar uno
      if (!project.share_token) {
        const crypto = await import("crypto");
        const newToken = crypto.randomBytes(32).toString("hex");
        await query(
          `UPDATE projects SET share_token = $1, share_token_created_at = NOW() WHERE id = $2`,
          [newToken, id]
        );
        shareUrl = `${APP_URL}/p/${newToken}`;
      }

      await sendProjectStateChangeEmail(
        project.cliente_externo_email,
        project.cliente_externo_nombre,
        { id: project.id, titulo: project.titulo },
        estadoAnterior,
        nuevoEstado,
        shareUrl
      );
    }

    return NextResponse.json({
      message: "Estado actualizado",
      estado_anterior: estadoAnterior,
      estado_nuevo: nuevoEstado,
      estado_label: getStateLabel(nuevoEstado)
    });
  } catch (error) {
    console.error("Error updating project state:", error);
    return NextResponse.json(
      { error: "Error al actualizar estado" },
      { status: 500 }
    );
  }
}

// GET - Obtener estados válidos para transición
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;

    // Obtener proyecto actual
    const projectResult = await query(
      `SELECT estado, visibilidad, id_cliente, id_miembro_propietario
       FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];
    const estadoActual = project.estado as ProjectState;

    // Verificar permisos
    const isClientOwner = tokenData.role === "cliente" && project.id_cliente === tokenData.id;
    const isMemberOwner = tokenData.role === "miembro" && project.id_miembro_propietario === tokenData.id;
    const isAdmin = tokenData.role === "admin";

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Determinar si es proyecto privado
    const bidsResult = await query(
      `SELECT COUNT(*) as count FROM project_bids
       WHERE id_project = $1 AND estado = 'aceptada' AND (removido IS NULL OR removido = FALSE)`,
      [id]
    );
    const hasCollaborators = parseInt(bidsResult.rows[0].count) > 0;
    const isPrivateProject = project.visibilidad === 'privado' && !hasCollaborators;

    // Importar funciones de estados válidos
    const { getNextPrivateProjectStates, getNextPublicProjectStates } = await import("@/lib/projectStates");

    const validStates = isPrivateProject
      ? getNextPrivateProjectStates(estadoActual)
      : getNextPublicProjectStates(estadoActual);

    return NextResponse.json({
      estado_actual: estadoActual,
      estado_actual_label: getStateLabel(estadoActual),
      is_private_project: isPrivateProject,
      has_collaborators: hasCollaborators,
      valid_transitions: validStates.map(s => ({
        estado: s,
        label: getStateLabel(s)
      }))
    });
  } catch (error) {
    console.error("Error getting valid states:", error);
    return NextResponse.json(
      { error: "Error al obtener estados validos" },
      { status: 500 }
    );
  }
}
