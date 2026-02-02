import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/projects/[id] - Get a single project with bids and requirements
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get project with client and member owner info
    const projectResult = await query(
      `SELECT
        p.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        json_build_object('id', mp.id, 'nombre', mp.nombre, 'foto', mp.foto, 'puesto', mp.puesto) as miembro_propietario
      FROM projects p
      LEFT JOIN clientes c ON p.id_cliente = c.id
      LEFT JOIN miembros mp ON p.id_miembro_propietario = mp.id
      WHERE p.id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const projectData = projectResult.rows[0];

    // Get user role and member id
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const userRol = userResult.rows[0]?.rol;
    const userMiembroId = userResult.rows[0]?.id_miembro;

    // Check if user is the member owner of this project
    const isMemberOwner = projectData.id_miembro_propietario && projectData.id_miembro_propietario === userMiembroId;

    // Visibility check for member-owned projects
    if (projectData.tipo_proyecto === "miembro") {
      // Clients cannot see member-owned projects
      if (userRol === "cliente") {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }

      // Private projects: only owner and admin can see
      if (projectData.visibilidad === "privado" && !isMemberOwner && userRol !== "admin") {
        return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
      }

      // Public projects: any member can see (for bidding/collaboration)
    } else {
      // Original visibility check for client-owned projects
      if (["planificado", "en_progreso"].includes(projectData.estado) && userRol === "miembro") {
        // When republicado, any member can view the project (like publicado)
        if (!(projectData.estado === "en_progreso" && projectData.republicado === true)) {
          const memberBid = await query(
            "SELECT id FROM project_bids WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada'",
            [projectId, userMiembroId]
          );
          if (memberBid.rows.length === 0) {
            return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
          }
        }
      }
    }

    // Get all accepted members (the "team") - excluding removed ones
    const acceptedMembersResult = await query(
      `SELECT pb.id as bid_id, pb.monto_acordado, pb.confirmado_por_miembro, pb.fecha_confirmacion,
              pb.trabajo_finalizado, pb.fecha_trabajo_finalizado,
              json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto, 'puesto', m.puesto) as miembro
       FROM project_bids pb
       LEFT JOIN miembros m ON pb.id_miembro = m.id
       WHERE pb.id_project = $1 AND pb.estado = 'aceptada'
         AND (pb.removido IS NULL OR pb.removido = FALSE)
       ORDER BY pb.fecha_aceptacion ASC`,
      [projectId]
    );

    // Get all bids (including removal info)
    const bidsResult = await query(
      `SELECT pb.*, pb.removido, pb.fecha_remocion, pb.motivo_remocion, pb.removido_por_id,
              json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto, 'puesto', m.puesto) as miembro
       FROM project_bids pb
       LEFT JOIN miembros m ON pb.id_miembro = m.id
       WHERE pb.id_project = $1
       ORDER BY pb.created_at DESC`,
      [projectId]
    );

    // Get requirements with completado_por and creador info
    const requirementsResult = await query(
      `SELECT pr.*,
        CASE WHEN pr.completado_por IS NOT NULL THEN
          json_build_object('id', mc.id, 'nombre', mc.nombre, 'foto', mc.foto)
        ELSE NULL END as miembro_completado,
        CASE
          WHEN pr.creado_por_miembro_id IS NOT NULL THEN
            json_build_object('id', mcr.id, 'nombre', mcr.nombre, 'foto', mcr.foto, 'tipo', 'miembro')
          WHEN pr.creado_por_cliente_id IS NOT NULL THEN
            json_build_object('id', ccr.id, 'nombre', ccr.nombre, 'foto', null, 'tipo', 'cliente')
          ELSE NULL
        END as creador
      FROM project_requirements pr
      LEFT JOIN miembros mc ON pr.completado_por = mc.id
      LEFT JOIN miembros mcr ON pr.creado_por_miembro_id = mcr.id
      LEFT JOIN clientes ccr ON pr.creado_por_cliente_id = ccr.id
      WHERE pr.id_project = $1
      ORDER BY pr.created_at ASC`,
      [projectId]
    );

    return NextResponse.json({
      project: projectData,
      bids: bidsResult.rows,
      requirements: requirementsResult.rows,
      accepted_members: acceptedMembersResult.rows,
      es_propietario_miembro: isMemberOwner,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Error al cargar el proyecto" }, { status: 500 });
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();

    // Special action: planificar
    if (body.action === "planificar") {
      const projectCheck = await query("SELECT estado FROM projects WHERE id = $1", [projectId]);
      if (projectCheck.rows.length === 0) {
        return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      if (projectCheck.rows[0].estado !== "publicado") {
        return NextResponse.json({ error: "Solo se puede planificar un proyecto publicado" }, { status: 400 });
      }

      // Check there's at least one accepted bid
      const acceptedBids = await query(
        "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE confirmado_por_miembro = true) as confirmados FROM project_bids WHERE id_project = $1 AND estado = 'aceptada'",
        [projectId]
      );
      const totalAccepted = parseInt(acceptedBids.rows[0].total);
      const totalConfirmed = parseInt(acceptedBids.rows[0].confirmados);

      if (totalAccepted === 0) {
        return NextResponse.json({ error: "Debes aceptar al menos una postulación antes de planificar" }, { status: 400 });
      }

      if (totalConfirmed < totalAccepted) {
        return NextResponse.json({ error: "Todos los miembros aceptados deben confirmar su participación antes de planificar" }, { status: 400 });
      }

      // Reject all remaining pending bids
      await query(
        "UPDATE project_bids SET estado = 'rechazada' WHERE id_project = $1 AND estado = 'pendiente'",
        [projectId]
      );

      // Set project to planificado
      await query(
        "UPDATE projects SET estado = 'planificado', updated_at = NOW() WHERE id = $1",
        [projectId]
      );

      return NextResponse.json({ success: true, message: "Proyecto planificado" });
    }

    // Special action: iniciar (planificado → en_progreso)
    if (body.action === "iniciar") {
      const projectCheck = await query("SELECT estado FROM projects WHERE id = $1", [projectId]);
      if (projectCheck.rows.length === 0) {
        return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      if (projectCheck.rows[0].estado !== "planificado") {
        return NextResponse.json({ error: "Solo se puede iniciar un proyecto planificado" }, { status: 400 });
      }

      await query(
        "UPDATE projects SET estado = 'en_progreso', updated_at = NOW() WHERE id = $1",
        [projectId]
      );

      return NextResponse.json({ success: true, message: "Proyecto iniciado" });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      "titulo",
      "descripcion",
      "presupuesto_min",
      "presupuesto_max",
      "fecha_limite",
      "estado",
      "visibilidad",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(projectId);
    const sql = `UPDATE projects SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ project: result.rows[0] });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Error al actualizar el proyecto" }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - Delete a cancelled project (only owner can delete)
export async function DELETE(request: NextRequest, context: RouteContext) {
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
    const userRole = userResult.rows[0].rol;
    const userMiembroId = userResult.rows[0].id_miembro;

    // Get project
    const projectResult = await query(
      "SELECT id, estado, id_cliente, id_miembro_propietario, tipo_proyecto FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Check permissions - only owner can delete
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

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado para eliminar este proyecto" }, { status: 403 });
    }

    // Only allow deletion of cancelled projects
    const cancelledStates = ["cancelado", "cancelado_sin_acuerdo", "cancelado_sin_presupuesto"];
    if (!cancelledStates.includes(project.estado) && !isAdmin) {
      return NextResponse.json(
        { error: "Solo se pueden eliminar proyectos cancelados" },
        { status: 400 }
      );
    }

    // Delete the project (cascades will handle related records)
    await query("DELETE FROM projects WHERE id = $1", [projectId]);

    return NextResponse.json({ success: true, message: "Proyecto eliminado" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Error al eliminar el proyecto" }, { status: 500 });
  }
}
