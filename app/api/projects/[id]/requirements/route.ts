import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectRequirements,
  getUntakenRequirements,
  getProjectById,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  checkAllRequirementsCompleted,
  markCompletionNotified,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";
import { createNotification, getUserIdByMemberId } from "@/lib/services/notification-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If project is confirmed and caller is a non-accepted member, show only untaken requirements
  if (project.confirmed_at && auth.role === "member") {
    const userRes = await query("SELECT member_id FROM users WHERE id = $1", [auth.userId]);
    const memberId = userRes.rows[0]?.member_id;
    if (memberId) {
      // Check if this member is accepted
      const bidRes = await query(
        "SELECT status FROM project_bids WHERE project_id = $1 AND member_id = $2",
        [projectId, memberId]
      );
      const bid = bidRes.rows[0];
      const isAccepted = bid?.status === "accepted";

      if (!isAccepted) {
        // Non-accepted member: only show untaken requirements
        const reqs = await getUntakenRequirements(projectId);
        return NextResponse.json({ data: reqs });
      }
    }
  }

  // Owner, admin, or accepted members see all requirements
  const reqs = await getProjectRequirements(projectId);
  return NextResponse.json({ data: reqs });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const req_ = await createRequirement({
    project_id: Number(id),
    title: body.title,
    description: body.description,
  });
  return NextResponse.json({ data: req_ }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();
  if (!body.requirement_id) {
    return NextResponse.json(
      { error: "requirement_id is required" },
      { status: 400 }
    );
  }

  const { requirement_id, ...data } = body;
  const updated = await updateRequirement(requirement_id, data);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check if all requirements are now completed and notify owner
  if (data.completed === true) {
    const project = await getProjectById(projectId);
    if (project && project.confirmed_at && !project.completion_notified_at) {
      const allDone = await checkAllRequirementsCompleted(projectId);
      if (allDone) {
        await markCompletionNotified(projectId);
        // Notify project owner
        try {
          const ownerRes = await query(
            `SELECT u.id FROM users u
             JOIN clients c ON LOWER(c.email) = LOWER(u.email)
             WHERE c.id = $1 LIMIT 1`,
            [project.client_id]
          );
          if (ownerRes.rows[0]) {
            await query(
              `INSERT INTO notifications (user_id, type, title, message, link)
               VALUES ($1, 'project_all_completed', $2, $3, $4)`,
              [
                ownerRes.rows[0].id,
                `Requerimientos completados: ${project.title}`,
                `Todos los requerimientos del proyecto "${project.title}" han sido completados. Revisa el proyecto para decidir los siguientes pasos.`,
                `/dashboard/projects/${projectId}`,
              ]
            );
          }
        } catch {
          // Don't fail
        }
      }
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  if (!body.requirement_id) {
    return NextResponse.json(
      { error: "requirement_id is required" },
      { status: 400 }
    );
  }

  const reqId = body.requirement_id;

  // Check if any accepted bid covers this requirement — block deletion
  const acceptedRes = await query(
    `SELECT id FROM project_bids
     WHERE project_id = $1 AND status = 'accepted' AND $2 = ANY(requirement_ids)`,
    [projectId, reqId]
  );
  if (acceptedRes.rows.length > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar un requerimiento asignado a un miembro aceptado" },
      { status: 400 }
    );
  }

  // Find pending bids that cover this requirement — notify and reset them
  const pendingRes = await query(
    `SELECT id, member_id FROM project_bids
     WHERE project_id = $1 AND status = 'pending' AND $2 = ANY(requirement_ids)`,
    [projectId, reqId]
  );

  if (pendingRes.rows.length > 0) {
    // Reset these bids back to "invited" so they can re-submit
    for (const bid of pendingRes.rows) {
      await query(
        `UPDATE project_bids
         SET status = 'invited', proposal = NULL, bid_amount = NULL,
             requirement_ids = '{}', work_dates = '{}', estimated_days = NULL
         WHERE id = $1`,
        [bid.id]
      );

      // Notify the member
      const userId = await getUserIdByMemberId(bid.member_id);
      if (userId) {
        await createNotification({
          user_id: userId,
          type: "requirement_deleted",
          title: "Requerimiento eliminado",
          message:
            "Un requerimiento del proyecto al que te postulaste fue eliminado. Revisa el proyecto y vuelve a enviar tu propuesta.",
          link: `/dashboard/projects/${projectId}`,
        });
      }
    }
  }

  const ok = await deleteRequirement(reqId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
