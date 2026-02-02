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

    // Get user profile to check role and id_miembro
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const userRole = userResult.rows[0].rol;
    const userMiembroId = userResult.rows[0].id_miembro;

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
    // Convert to numbers for comparison
    const projectOwnerId = project.id_miembro_propietario ? Number(project.id_miembro_propietario) : null;
    const userMemberId = userMiembroId ? Number(userMiembroId) : null;

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
    const isMemberOwner = (userRole === "miembro" || userRole === "admin") && projectOwnerId !== null && projectOwnerId === userMemberId;
    const isAdmin = userRole === "admin";

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

    // Si el proyecto se completa, crear entradas de portafolio
    if (nuevoEstado === 'completado') {
      try {
        // Get project info for portfolio
        const projectInfoResult = await query(
          "SELECT titulo, descripcion, id_miembro_propietario FROM projects WHERE id = $1",
          [id]
        );
        const projectInfo = projectInfoResult.rows[0];

        // For private projects (no collaborators), add owner to portfolio if they completed requirements
        if (isPrivateProject && projectInfo.id_miembro_propietario) {
          const ownerReqsResult = await query(
            `SELECT titulo, descripcion, costo
             FROM project_requirements
             WHERE id_project = $1 AND completado = true AND completado_por = $2`,
            [id, projectInfo.id_miembro_propietario]
          );

          // If owner completed requirements, or just add the project anyway
          const ownerFunciones = ownerReqsResult.rows.map((r: any) => ({
            titulo: r.titulo,
            descripcion: r.descripcion,
            costo: r.costo,
          }));

          // For private projects, add to portfolio even without requirements
          // (owner did all the work)
          await query(
            `INSERT INTO member_portfolio (
               id_miembro, id_project, titulo, descripcion, funciones, monto_ganado, fecha_proyecto_completado
             ) VALUES ($1, $2, $3, $4, $5, NULL, NOW())
             ON CONFLICT (id_miembro, id_project) DO UPDATE SET
               titulo = EXCLUDED.titulo,
               descripcion = EXCLUDED.descripcion,
               funciones = EXCLUDED.funciones,
               fecha_proyecto_completado = NOW()`,
            [
              projectInfo.id_miembro_propietario,
              id,
              projectInfo.titulo,
              projectInfo.descripcion,
              JSON.stringify(ownerFunciones),
            ]
          );
        }

        // For collaborative projects, add portfolio entries for all accepted members
        if (hasCollaborators) {
          const acceptedMembersResult = await query(
            `SELECT pb.id_miembro, pb.monto_acordado
             FROM project_bids pb
             WHERE pb.id_project = $1
               AND pb.estado = 'aceptada'
               AND pb.confirmado_por_miembro = true
               AND (pb.removido IS NULL OR pb.removido = FALSE)`,
            [id]
          );

          for (const member of acceptedMembersResult.rows) {
            const memberReqsResult = await query(
              `SELECT titulo, descripcion, costo
               FROM project_requirements
               WHERE id_project = $1 AND completado = true AND completado_por = $2`,
              [id, member.id_miembro]
            );

            const funciones = memberReqsResult.rows.map((r: any) => ({
              titulo: r.titulo,
              descripcion: r.descripcion,
              costo: r.costo,
            }));

            await query(
              `INSERT INTO member_portfolio (
                 id_miembro, id_project, titulo, descripcion, funciones, monto_ganado, fecha_proyecto_completado
               ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT (id_miembro, id_project) DO UPDATE SET
                 titulo = EXCLUDED.titulo,
                 descripcion = EXCLUDED.descripcion,
                 funciones = EXCLUDED.funciones,
                 monto_ganado = EXCLUDED.monto_ganado,
                 fecha_proyecto_completado = NOW()`,
              [
                member.id_miembro,
                id,
                projectInfo.titulo,
                projectInfo.descripcion,
                JSON.stringify(funciones),
                member.monto_acordado,
              ]
            );
          }
        }
      } catch (portfolioError) {
        console.error("Error creating portfolio entries:", portfolioError);
        // Don't fail the request if portfolio creation fails
      }
    }

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

    // Get user profile to check role and id_miembro
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const userRole = userResult.rows[0].rol;
    const userMiembroId = userResult.rows[0].id_miembro;

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

    // Verificar permisos - convert to numbers for comparison
    const projectOwnerId = project.id_miembro_propietario ? Number(project.id_miembro_propietario) : null;
    const userMemberId = userMiembroId ? Number(userMiembroId) : null;

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
    const isMemberOwner = (userRole === "miembro" || userRole === "admin") && projectOwnerId !== null && projectOwnerId === userMemberId;
    const isAdmin = userRole === "admin";

    console.log("State GET - Auth check:", {
      userRole,
      userMemberId,
      projectOwnerId,
      isClientOwner,
      isMemberOwner,
      isAdmin
    });

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
      transitions: validStates.map(s => ({
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
