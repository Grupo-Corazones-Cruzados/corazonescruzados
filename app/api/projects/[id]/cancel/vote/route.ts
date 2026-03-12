import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  createCancellationVote,
  evaluateCancellationVotes,
  resolveCancellationRequest,
  getProjectById,
  getAcceptedMembers,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  if (!body.request_id || !body.vote) {
    return NextResponse.json(
      { error: "request_id and vote are required" },
      { status: 400 }
    );
  }

  if (!["approve", "reject"].includes(body.vote)) {
    return NextResponse.json(
      { error: "vote must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify caller is an accepted member
  if (auth.role !== "member") {
    return NextResponse.json({ error: "Solo miembros aceptados pueden votar" }, { status: 403 });
  }

  // Look up member_id from user
  const userRes = await query("SELECT member_id FROM users WHERE id = $1", [auth.userId]);
  const memberId = userRes.rows[0]?.member_id;
  if (!memberId) {
    return NextResponse.json({ error: "No se encontró tu perfil de miembro" }, { status: 403 });
  }

  const members = await getAcceptedMembers(projectId);
  const isAccepted = members.some((m) => m.id === memberId);
  if (!isAccepted) {
    return NextResponse.json({ error: "No eres miembro aceptado de este proyecto" }, { status: 403 });
  }

  // Verify the request exists and is pending
  const reqRes = await query(
    "SELECT * FROM project_cancellation_requests WHERE id = $1 AND project_id = $2 AND status = 'pending'",
    [body.request_id, projectId]
  );
  if (reqRes.rows.length === 0) {
    return NextResponse.json({ error: "Solicitud no encontrada o ya resuelta" }, { status: 404 });
  }

  // Record vote
  const vote = await createCancellationVote({
    request_id: body.request_id,
    member_id: memberId,
    user_id: auth.userId,
    vote: body.vote,
    comment: body.comment,
  });

  // Evaluate
  const evaluation = await evaluateCancellationVotes(body.request_id, projectId);

  if (evaluation.resolved) {
    // Resolve the request
    await resolveCancellationRequest(body.request_id, evaluation.status, auth.userId);

    // Notify project owner
    try {
      const ownerRes = await query(
        `SELECT u.id FROM users u
         JOIN clients c ON LOWER(c.email) = LOWER(u.email)
         WHERE c.id = $1 LIMIT 1`,
        [project.client_id]
      );
      if (ownerRes.rows[0]) {
        const msg = evaluation.status === "approved"
          ? `La cancelación del proyecto "${project.title}" ha sido aprobada por todos los miembros.`
          : `Un miembro rechazó la cancelación del proyecto "${project.title}". El proyecto continúa.`;
        await query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, 'cancellation_resolved', $2, $3, $4)`,
          [
            ownerRes.rows[0].id,
            evaluation.status === "approved" ? "Cancelación aprobada" : "Cancelación rechazada",
            msg,
            `/dashboard/projects/${projectId}`,
          ]
        );
      }
    } catch {
      // Don't fail
    }

    // Notify all accepted members about resolution
    for (const member of members) {
      try {
        const userRes = await query(
          "SELECT id FROM users WHERE member_id = $1 LIMIT 1",
          [member.id]
        );
        if (userRes.rows[0]) {
          const msg = evaluation.status === "approved"
            ? `El proyecto "${project.title}" ha sido cancelado.`
            : `La cancelación del proyecto "${project.title}" fue rechazada. El proyecto continúa.`;
          await query(
            `INSERT INTO notifications (user_id, type, title, message, link)
             VALUES ($1, 'cancellation_resolved', $2, $3, $4)`,
            [
              userRes.rows[0].id,
              evaluation.status === "approved" ? "Proyecto cancelado" : "Cancelación rechazada",
              msg,
              `/dashboard/projects/${projectId}`,
            ]
          );
        }
      } catch {
        // Don't fail
      }
    }
  } else {
    // Notify owner about the vote
    try {
      const ownerRes = await query(
        `SELECT u.id FROM users u
         JOIN clients c ON LOWER(c.email) = LOWER(u.email)
         WHERE c.id = $1 LIMIT 1`,
        [project.client_id]
      );
      if (ownerRes.rows[0]) {
        const memberName = members.find((m) => m.id === memberId)?.name || "Un miembro";
        await query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, 'cancellation_vote', $2, $3, $4)`,
          [
            ownerRes.rows[0].id,
            "Voto de cancelación recibido",
            `${memberName} ha votado "${body.vote === 'approve' ? 'aprobar' : 'rechazar'}" la cancelación del proyecto "${project.title}". ${evaluation.approves}/${evaluation.totalMembers} votos recibidos.`,
            `/dashboard/projects/${projectId}`,
          ]
        );
      }
    } catch {
      // Don't fail
    }
  }

  return NextResponse.json({
    data: vote,
    evaluation,
  });
}
