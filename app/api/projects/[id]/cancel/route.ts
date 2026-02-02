import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/cancel - Cancel a project in early states
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { motivo } = body;

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

    // Check permissions - only owner can cancel
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
      return NextResponse.json({ error: "No autorizado para cancelar este proyecto" }, { status: 403 });
    }

    // Only allow cancellation in early states
    const allowedStates = ["borrador", "publicado", "planificado"];
    if (!allowedStates.includes(project.estado)) {
      return NextResponse.json(
        { error: "Solo se puede cancelar un proyecto en estado borrador, publicado o planificado" },
        { status: 400 }
      );
    }

    // Cancel the project
    await query(
      `UPDATE projects
       SET estado = 'cancelado',
           justificacion_cierre = $1,
           cerrado_por = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        motivo || "Proyecto cancelado por el propietario",
        userRole === "cliente" ? "cliente" : "miembro",
        projectId
      ]
    );

    // Reject all pending bids
    await query(
      `UPDATE project_bids
       SET estado = 'rechazada'
       WHERE id_project = $1 AND estado = 'pendiente'`,
      [projectId]
    );

    return NextResponse.json({
      success: true,
      message: "Proyecto cancelado exitosamente",
    });
  } catch (error) {
    console.error("Error canceling project:", error);
    return NextResponse.json({ error: "Error al cancelar el proyecto" }, { status: 500 });
  }
}
