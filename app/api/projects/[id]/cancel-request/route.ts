import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { type ProjectState } from "@/lib/projectStates";

type RouteContext = { params: Promise<{ id: string }> };

// States that require confirmation-based cancellation
const CONFIRMATION_REQUIRED_STATES: ProjectState[] = [
  "iniciado",
  "en_progreso",
  "en_implementacion",
  "en_pruebas",
];

// GET /api/projects/[id]/cancel-request - Get cancellation request status
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Get active cancellation request
    const requestResult = await query(
      `SELECT cr.*,
              up.email as creador_email,
              CASE
                WHEN cr.creado_por_tipo = 'miembro' THEN m.nombre
                WHEN cr.creado_por_tipo = 'cliente' THEN c.nombre
              END as creador_nombre
       FROM project_cancellation_requests cr
       LEFT JOIN user_profiles up ON up.id = cr.creado_por_id
       LEFT JOIN miembros m ON up.id_miembro = m.id AND cr.creado_por_tipo = 'miembro'
       LEFT JOIN clientes c ON up.email = c.correo_electronico AND cr.creado_por_tipo = 'cliente'
       WHERE cr.id_project = $1 AND cr.estado = 'pendiente'
       ORDER BY cr.created_at DESC
       LIMIT 1`,
      [projectId]
    );

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ hasPendingRequest: false });
    }

    const cancelRequest = requestResult.rows[0];

    // Get all votes for this request
    const votesResult = await query(
      `SELECT cv.*,
              CASE
                WHEN cv.tipo_participante = 'miembro' OR cv.tipo_participante = 'propietario' THEN m.nombre
                WHEN cv.tipo_participante = 'cliente' THEN c.nombre
              END as participante_nombre
       FROM project_cancellation_votes cv
       LEFT JOIN miembros m ON cv.id_participante = m.id AND (cv.tipo_participante = 'miembro' OR cv.tipo_participante = 'propietario')
       LEFT JOIN clientes c ON cv.id_participante = c.id AND cv.tipo_participante = 'cliente'
       WHERE cv.id_cancellation_request = $1`,
      [cancelRequest.id]
    );

    // Get all participants who need to vote
    const projectResult = await query(
      `SELECT p.id_cliente, p.id_miembro_propietario, p.tipo_proyecto,
              c.nombre as cliente_nombre,
              mp.nombre as propietario_nombre
       FROM projects p
       LEFT JOIN clientes c ON p.id_cliente = c.id
       LEFT JOIN miembros mp ON p.id_miembro_propietario = mp.id
       WHERE p.id = $1`,
      [projectId]
    );

    const project = projectResult.rows[0];

    // Get accepted team members
    const teamResult = await query(
      `SELECT pb.id_miembro, m.nombre
       FROM project_bids pb
       JOIN miembros m ON pb.id_miembro = m.id
       WHERE pb.id_project = $1
         AND pb.estado = 'aceptada'
         AND (pb.removido IS NULL OR pb.removido = FALSE)`,
      [projectId]
    );

    // Build list of required voters
    const requiredVoters: { id: number; tipo: string; nombre: string }[] = [];

    // Add project owner
    if (project.tipo_proyecto === "cliente" && project.id_cliente) {
      requiredVoters.push({
        id: project.id_cliente,
        tipo: "cliente",
        nombre: project.cliente_nombre || "Cliente",
      });
    } else if (project.id_miembro_propietario) {
      requiredVoters.push({
        id: project.id_miembro_propietario,
        tipo: "propietario",
        nombre: project.propietario_nombre || "Propietario",
      });
    }

    // Add team members
    for (const member of teamResult.rows) {
      // Don't add if they're already the owner
      if (member.id_miembro !== project.id_miembro_propietario) {
        requiredVoters.push({
          id: member.id_miembro,
          tipo: "miembro",
          nombre: member.nombre,
        });
      }
    }

    // Calculate vote status
    interface VoteRow {
      voto: string;
      participante_nombre: string;
      tipo_participante: string;
      comentario: string | null;
      created_at: string;
    }
    const votes = votesResult.rows as VoteRow[];
    const confirmedVotes = votes.filter((v) => v.voto === "confirmar").length;
    const rejectedVotes = votes.filter((v) => v.voto === "rechazar").length;
    const pendingVotes = requiredVoters.length - votes.length;

    return NextResponse.json({
      hasPendingRequest: true,
      request: {
        id: cancelRequest.id,
        motivo: cancelRequest.motivo,
        creador_nombre: cancelRequest.creador_nombre,
        created_at: cancelRequest.created_at,
      },
      votes: votes.map((v) => ({
        participante_nombre: v.participante_nombre,
        tipo_participante: v.tipo_participante,
        voto: v.voto,
        comentario: v.comentario,
        created_at: v.created_at,
      })),
      requiredVoters,
      summary: {
        total: requiredVoters.length,
        confirmed: confirmedVotes,
        rejected: rejectedVotes,
        pending: pendingVotes,
      },
    });
  } catch (error) {
    console.error("Error getting cancellation request:", error);
    return NextResponse.json({ error: "Error al obtener solicitud de cancelacion" }, { status: 500 });
  }
}

// POST /api/projects/[id]/cancel-request - Create or vote on cancellation request
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { motivo, voto, comentario } = body;

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
      `SELECT id, estado, id_cliente, id_miembro_propietario, tipo_proyecto, titulo
       FROM projects WHERE id = $1`,
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Check if project is in a state that requires confirmation
    if (!CONFIRMATION_REQUIRED_STATES.includes(project.estado)) {
      return NextResponse.json(
        { error: "Este proyecto no requiere confirmacion para cancelar. Use el endpoint /cancel en su lugar." },
        { status: 400 }
      );
    }

    // Check if user is a participant
    const isClientOwner = userRole === "cliente" && project.id_cliente === parseInt(tokenData.userId);
    const projectOwnerId = project.id_miembro_propietario ? Number(project.id_miembro_propietario) : null;
    const userMemberId = userMiembroId ? Number(userMiembroId) : null;
    const isMemberOwner = (userRole === "miembro" || userRole === "admin") && projectOwnerId !== null && projectOwnerId === userMemberId;

    let isTeamMember = false;
    if (userMemberId) {
      const teamCheck = await query(
        `SELECT id FROM project_bids
         WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada' AND (removido IS NULL OR removido = FALSE)`,
        [projectId, userMemberId]
      );
      isTeamMember = teamCheck.rows.length > 0;
    }

    const isParticipant = isClientOwner || isMemberOwner || isTeamMember;
    if (!isParticipant) {
      return NextResponse.json({ error: "No autorizado - no eres participante del proyecto" }, { status: 403 });
    }

    // Determine participant type and ID
    let participanteId: number;
    let tipoParticipante: string;

    if (isClientOwner) {
      // Get client ID from user profile
      const clientResult = await query(
        `SELECT c.id FROM clientes c
         JOIN user_profiles up ON up.email = c.correo_electronico
         WHERE up.id = $1`,
        [tokenData.userId]
      );
      if (clientResult.rows.length === 0) {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
      participanteId = clientResult.rows[0].id;
      tipoParticipante = "cliente";
    } else if (isMemberOwner) {
      participanteId = userMemberId!;
      tipoParticipante = "propietario";
    } else {
      participanteId = userMemberId!;
      tipoParticipante = "miembro";
    }

    // Check if there's already a pending request
    const existingRequest = await query(
      `SELECT id FROM project_cancellation_requests
       WHERE id_project = $1 AND estado = 'pendiente'`,
      [projectId]
    );

    let requestId: number;

    if (existingRequest.rows.length === 0) {
      // Create new cancellation request
      if (!motivo || motivo.trim().length < 5) {
        return NextResponse.json(
          { error: "Motivo de cancelacion requerido (minimo 5 caracteres)" },
          { status: 400 }
        );
      }

      const creadoPorTipo = userRole === "cliente" ? "cliente" : "miembro";

      const newRequest = await query(
        `INSERT INTO project_cancellation_requests (id_project, motivo, creado_por_id, creado_por_tipo)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [projectId, motivo.trim(), tokenData.userId, creadoPorTipo]
      );

      requestId = newRequest.rows[0].id;

      // Auto-vote as the creator (confirmar)
      await query(
        `INSERT INTO project_cancellation_votes (id_cancellation_request, id_participante, tipo_participante, voto)
         VALUES ($1, $2, $3, 'confirmar')`,
        [requestId, participanteId, tipoParticipante]
      );
    } else {
      // Vote on existing request
      requestId = existingRequest.rows[0].id;

      if (!voto || !["confirmar", "rechazar"].includes(voto)) {
        return NextResponse.json(
          { error: "Voto invalido. Debe ser 'confirmar' o 'rechazar'" },
          { status: 400 }
        );
      }

      // Check if already voted
      const existingVote = await query(
        `SELECT id FROM project_cancellation_votes
         WHERE id_cancellation_request = $1 AND id_participante = $2 AND tipo_participante = $3`,
        [requestId, participanteId, tipoParticipante]
      );

      if (existingVote.rows.length > 0) {
        // Update vote
        await query(
          `UPDATE project_cancellation_votes
           SET voto = $1, comentario = $2, created_at = NOW()
           WHERE id_cancellation_request = $3 AND id_participante = $4 AND tipo_participante = $5`,
          [voto, comentario?.trim() || null, requestId, participanteId, tipoParticipante]
        );
      } else {
        // Insert new vote
        await query(
          `INSERT INTO project_cancellation_votes (id_cancellation_request, id_participante, tipo_participante, voto, comentario)
           VALUES ($1, $2, $3, $4, $5)`,
          [requestId, participanteId, tipoParticipante, voto, comentario?.trim() || null]
        );
      }
    }

    // Get vote counts
    const voteCountResult = await query(
      `SELECT
        COUNT(*) FILTER (WHERE voto = 'confirmar') as confirmados,
        COUNT(*) FILTER (WHERE voto = 'rechazar') as rechazados,
        COUNT(*) as total
       FROM project_cancellation_votes
       WHERE id_cancellation_request = $1`,
      [requestId]
    );

    const voteCounts = voteCountResult.rows[0];
    const confirmados = parseInt(voteCounts.confirmados);
    const rechazados = parseInt(voteCounts.rechazados);

    // If someone rejected, cancel the request
    if (rechazados > 0) {
      await query(
        `UPDATE project_cancellation_requests
         SET estado = 'rechazada', finalizado_at = NOW()
         WHERE id = $1`,
        [requestId]
      );

      return NextResponse.json({
        success: true,
        message: "Solicitud de cancelacion rechazada por un participante",
        status: "rechazada",
      });
    }

    // Check if we need to count participants more accurately
    // Get actual count of required voters
    let requiredVotersCount = 0;

    // If project has client owner (tipo_proyecto = 'cliente')
    if (project.tipo_proyecto === "cliente" && project.id_cliente) {
      requiredVotersCount++;
    }
    // If project has member owner
    if (project.id_miembro_propietario) {
      requiredVotersCount++;
    }
    // Add team members (excluding owner if they're already counted)
    const teamMembersResult = await query(
      `SELECT COUNT(*) as count FROM project_bids
       WHERE id_project = $1
         AND estado = 'aceptada'
         AND (removido IS NULL OR removido = FALSE)
         AND id_miembro != COALESCE($2, -1)`,
      [projectId, project.id_miembro_propietario]
    );
    requiredVotersCount += parseInt(teamMembersResult.rows[0].count);

    // If all required participants confirmed, cancel the project
    if (confirmados >= requiredVotersCount && requiredVotersCount > 0) {
      // Get the reason from the request
      const requestData = await query(
        `SELECT motivo FROM project_cancellation_requests WHERE id = $1`,
        [requestId]
      );

      // Cancel the project
      await query(
        `UPDATE projects
         SET estado = 'cancelado',
             justificacion_cierre = $1,
             cerrado_por = 'equipo',
             updated_at = NOW()
         WHERE id = $2`,
        [requestData.rows[0].motivo, projectId]
      );

      // Mark request as approved
      await query(
        `UPDATE project_cancellation_requests
         SET estado = 'aprobada', finalizado_at = NOW()
         WHERE id = $1`,
        [requestId]
      );

      return NextResponse.json({
        success: true,
        message: "Proyecto cancelado - todos los participantes confirmaron",
        status: "aprobada",
        projectCancelled: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: existingRequest.rows.length === 0
        ? "Solicitud de cancelacion creada"
        : "Voto registrado",
      status: "pendiente",
      votosConfirmados: confirmados,
      votosRequeridos: requiredVotersCount,
    });
  } catch (error) {
    console.error("Error handling cancellation request:", error);
    return NextResponse.json({ error: "Error al procesar solicitud de cancelacion" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/cancel-request - Withdraw cancellation request (only creator can do this)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get pending request
    const requestResult = await query(
      `SELECT id, creado_por_id FROM project_cancellation_requests
       WHERE id_project = $1 AND estado = 'pendiente'`,
      [projectId]
    );

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ error: "No hay solicitud pendiente" }, { status: 404 });
    }

    const cancelRequest = requestResult.rows[0];

    // Only creator can withdraw
    if (cancelRequest.creado_por_id !== parseInt(tokenData.userId)) {
      return NextResponse.json({ error: "Solo el creador puede retirar la solicitud" }, { status: 403 });
    }

    // Delete the request (cascade will delete votes)
    await query(
      `DELETE FROM project_cancellation_requests WHERE id = $1`,
      [cancelRequest.id]
    );

    return NextResponse.json({
      success: true,
      message: "Solicitud de cancelacion retirada",
    });
  } catch (error) {
    console.error("Error withdrawing cancellation request:", error);
    return NextResponse.json({ error: "Error al retirar solicitud" }, { status: 500 });
  }
}
