import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { sendProjectCompletedEmail } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/finish-work - Mark member's work as finished
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get user info
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const userRol = userResult.rows[0].rol;
    const userMiembroId = userResult.rows[0].id_miembro;

    if (userRol !== "miembro" && userRol !== "admin") {
      return NextResponse.json({ error: "Solo miembros pueden marcar trabajo finalizado" }, { status: 403 });
    }

    if (!userMiembroId) {
      return NextResponse.json({ error: "No se encontró el perfil de miembro" }, { status: 400 });
    }

    // Verify project is in an active working state
    const projectResult = await query(
      "SELECT estado, cliente_externo_email, cliente_externo_nombre, share_token FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    const activeStates = ["iniciado", "en_progreso", "en_implementacion", "en_pruebas"];
    if (!activeStates.includes(projectResult.rows[0].estado)) {
      return NextResponse.json({ error: "El proyecto no está en un estado activo" }, { status: 400 });
    }

    // Verify member has an accepted bid (not removed)
    const bidResult = await query(
      "SELECT id, trabajo_finalizado FROM project_bids WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada' AND (removido IS NULL OR removido = FALSE)",
      [projectId, userMiembroId]
    );
    if (bidResult.rows.length === 0) {
      return NextResponse.json({ error: "No tienes una postulación aceptada en este proyecto" }, { status: 403 });
    }

    const alreadyFinished = bidResult.rows[0].trabajo_finalizado;

    if (alreadyFinished) {
      // Unmark work as finished
      await query(
        "UPDATE project_bids SET trabajo_finalizado = false, fecha_trabajo_finalizado = NULL WHERE id = $1",
        [bidResult.rows[0].id]
      );

      return NextResponse.json({
        success: true,
        proyecto_completado: false,
        undone: true,
        message: "Trabajo desmarcado como finalizado.",
      });
    }

    // Mark work as finished
    await query(
      "UPDATE project_bids SET trabajo_finalizado = true, fecha_trabajo_finalizado = NOW() WHERE id = $1",
      [bidResult.rows[0].id]
    );

    // Auto-check: did all accepted members (not removed) finish?
    const countResult = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE trabajo_finalizado = true) as finalizados
      FROM project_bids
      WHERE id_project = $1 AND estado = 'aceptada' AND (removido IS NULL OR removido = FALSE)`,
      [projectId]
    );

    const total = parseInt(countResult.rows[0].total);
    const finalizados = parseInt(countResult.rows[0].finalizados);
    let proyecto_completado = false;

    if (total > 0 && finalizados >= total) {
      // All members finished - auto-complete project
      await query(
        "UPDATE projects SET estado = 'completado', updated_at = NOW() WHERE id = $1",
        [projectId]
      );
      proyecto_completado = true;

      // Create portfolio entries for all participating members
      try {
        // Get project info for portfolio
        const projectInfoResult = await query(
          "SELECT titulo, descripcion FROM projects WHERE id = $1",
          [projectId]
        );
        const projectInfo = projectInfoResult.rows[0];

        // Get all accepted members (not removed) with their bids
        const acceptedMembersResult = await query(
          `SELECT pb.id_miembro, pb.monto_acordado
           FROM project_bids pb
           WHERE pb.id_project = $1
             AND pb.estado = 'aceptada'
             AND pb.confirmado_por_miembro = true
             AND (pb.removido IS NULL OR pb.removido = FALSE)`,
          [projectId]
        );

        // For each member, get the requirements they completed and create portfolio entry
        for (const member of acceptedMembersResult.rows) {
          // Get requirements completed by this member
          const memberReqsResult = await query(
            `SELECT titulo, descripcion, costo
             FROM project_requirements
             WHERE id_project = $1 AND completado = true AND completado_por = $2`,
            [projectId, member.id_miembro]
          );

          const funciones = memberReqsResult.rows.map((r: any) => ({
            titulo: r.titulo,
            descripcion: r.descripcion,
            costo: r.costo,
          }));

          // Insert or update portfolio entry (upsert)
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
              projectId,
              projectInfo.titulo,
              projectInfo.descripcion,
              JSON.stringify(funciones),
              member.monto_acordado,
            ]
          );
        }

        // Also add portfolio entry for the project owner if they completed any requirements
        const ownerResult = await query(
          "SELECT id_miembro_propietario FROM projects WHERE id = $1",
          [projectId]
        );
        const ownerId = ownerResult.rows[0]?.id_miembro_propietario;

        if (ownerId) {
          // Check if owner already has a portfolio entry (they might be an accepted member too)
          const ownerHasEntry = acceptedMembersResult.rows.some(
            (m: any) => m.id_miembro === ownerId
          );

          if (!ownerHasEntry) {
            // Check if owner completed any requirements
            const ownerReqsResult = await query(
              `SELECT titulo, descripcion, costo
               FROM project_requirements
               WHERE id_project = $1 AND completado = true AND completado_por = $2`,
              [projectId, ownerId]
            );

            if (ownerReqsResult.rows.length > 0) {
              const ownerFunciones = ownerReqsResult.rows.map((r: any) => ({
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
                   fecha_proyecto_completado = NOW()`,
                [
                  ownerId,
                  projectId,
                  projectInfo.titulo,
                  projectInfo.descripcion,
                  JSON.stringify(ownerFunciones),
                  null, // Owner doesn't have monto_acordado
                ]
              );
            }
          }
        }
      } catch (portfolioError) {
        console.error("Error creating portfolio entries:", portfolioError);
        // Don't fail the request if portfolio creation fails
      }

      // Send completion email to client
      try {
        // Get project details with client info
        const projectDetails = await query(
          `SELECT p.id, p.titulo, p.descripcion, p.id_cliente,
                  c.correo_electronico as cliente_email, c.nombre as cliente_nombre
           FROM projects p
           LEFT JOIN clientes c ON p.id_cliente = c.id
           WHERE p.id = $1`,
          [projectId]
        );

        if (projectDetails.rows.length > 0 && projectDetails.rows[0].cliente_email) {
          const proj = projectDetails.rows[0];

          // Get requirements with creator and completor info
          const requirementsResult = await query(
            `SELECT pr.titulo, pr.descripcion, pr.costo, pr.completado,
                    CASE
                      WHEN pr.creado_por_miembro_id IS NOT NULL THEN
                        json_build_object('nombre', mcr.nombre, 'tipo', 'miembro')
                      WHEN pr.creado_por_cliente_id IS NOT NULL THEN
                        json_build_object('nombre', ccr.nombre, 'tipo', 'cliente')
                      ELSE NULL
                    END as creador,
                    CASE WHEN pr.completado_por IS NOT NULL THEN
                      json_build_object('nombre', mc.nombre)
                    ELSE NULL END as miembro_completado
             FROM project_requirements pr
             LEFT JOIN miembros mcr ON pr.creado_por_miembro_id = mcr.id
             LEFT JOIN clientes ccr ON pr.creado_por_cliente_id = ccr.id
             LEFT JOIN miembros mc ON pr.completado_por = mc.id
             WHERE pr.id_project = $1
             ORDER BY pr.created_at ASC`,
            [projectId]
          );

          // Get team members with amounts (excluding removed)
          const teamResult = await query(
            `SELECT m.nombre, pb.monto_acordado
             FROM project_bids pb
             JOIN miembros m ON pb.id_miembro = m.id
             WHERE pb.id_project = $1 AND pb.estado = 'aceptada' AND pb.confirmado_por_miembro = true
               AND (pb.removido IS NULL OR pb.removido = FALSE)`,
            [projectId]
          );

          await sendProjectCompletedEmail(
            proj.cliente_email,
            { id: proj.id, titulo: proj.titulo, descripcion: proj.descripcion },
            requirementsResult.rows,
            teamResult.rows,
            proj.cliente_nombre
          );
        }

        // Also send to external client if exists
        if (projectResult.rows[0]?.cliente_externo_email && projectResult.rows[0]?.cliente_externo_nombre) {
          const proj = projectDetails.rows[0];
          const externalEmail = projectResult.rows[0].cliente_externo_email;
          const externalNombre = projectResult.rows[0].cliente_externo_nombre;

          // Get requirements
          const requirementsResult = await query(
            `SELECT pr.titulo, pr.descripcion, pr.costo, pr.completado,
                    CASE
                      WHEN pr.creado_por_miembro_id IS NOT NULL THEN
                        json_build_object('nombre', mcr.nombre, 'tipo', 'miembro')
                      WHEN pr.creado_por_cliente_id IS NOT NULL THEN
                        json_build_object('nombre', ccr.nombre, 'tipo', 'cliente')
                      ELSE NULL
                    END as creador,
                    CASE WHEN pr.completado_por IS NOT NULL THEN
                      json_build_object('nombre', mc.nombre)
                    ELSE NULL END as miembro_completado
             FROM project_requirements pr
             LEFT JOIN miembros mcr ON pr.creado_por_miembro_id = mcr.id
             LEFT JOIN clientes ccr ON pr.creado_por_cliente_id = ccr.id
             LEFT JOIN miembros mc ON pr.completado_por = mc.id
             WHERE pr.id_project = $1
             ORDER BY pr.created_at ASC`,
            [projectId]
          );

          // Get team
          const teamResult = await query(
            `SELECT m.nombre, pb.monto_acordado
             FROM project_bids pb
             JOIN miembros m ON pb.id_miembro = m.id
             WHERE pb.id_project = $1 AND pb.estado = 'aceptada' AND pb.confirmado_por_miembro = true
               AND (pb.removido IS NULL OR pb.removido = FALSE)`,
            [projectId]
          );

          await sendProjectCompletedEmail(
            externalEmail,
            { id: proj.id, titulo: proj.titulo, descripcion: proj.descripcion },
            requirementsResult.rows,
            teamResult.rows,
            externalNombre
          );
        }
      } catch (emailError) {
        console.error("Error sending project completion email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      proyecto_completado,
      undone: false,
      message: proyecto_completado
        ? "Proyecto completado automáticamente. Todos los miembros finalizaron su trabajo."
        : "Trabajo marcado como finalizado.",
    });
  } catch (error) {
    console.error("Error finishing work:", error);
    return NextResponse.json({ error: "Error al marcar trabajo como finalizado" }, { status: 500 });
  }
}
