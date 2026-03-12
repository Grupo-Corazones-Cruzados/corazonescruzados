import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectById,
  getRequirementAssignments,
  createRequirementAssignment,
  submitAssignmentCost,
  resolveAssignment,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";
import { createNotification, getUserIdByMemberId } from "@/lib/services/notification-service";

// GET — list assignments for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const assignments = await getRequirementAssignments(Number(id));
  return NextResponse.json({ data: assignments });
}

// POST — creator assigns a requirement to an accepted member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  const { requirement_id, member_id, proposed_cost } = body;
  if (!requirement_id || !member_id || proposed_cost == null) {
    return NextResponse.json(
      { error: "requirement_id, member_id, and proposed_cost are required" },
      { status: 400 }
    );
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only owner (matching client) or admin can assign
  if (auth.role !== "admin") {
    const clientRes = await query(
      "SELECT id FROM clients WHERE LOWER(email) = LOWER($1)",
      [auth.email]
    );
    if (!clientRes.rows[0] || clientRes.rows[0].id !== project.client_id) {
      return NextResponse.json({ error: "Solo el creador puede asignar" }, { status: 403 });
    }
  }

  // Verify the member is accepted on this project
  const bidRes = await query(
    "SELECT id FROM project_bids WHERE project_id = $1 AND member_id = $2 AND status = 'accepted'",
    [projectId, member_id]
  );
  if (bidRes.rows.length === 0) {
    return NextResponse.json({ error: "El miembro no está aceptado en este proyecto" }, { status: 400 });
  }

  // Verify the requirement belongs to this project
  const reqRes = await query(
    "SELECT id FROM project_requirements WHERE id = $1 AND project_id = $2",
    [requirement_id, projectId]
  );
  if (reqRes.rows.length === 0) {
    return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });
  }

  // Check for existing assignment for this requirement + member
  const existingRes = await query(
    "SELECT id FROM requirement_assignments WHERE requirement_id = $1 AND member_id = $2 AND status NOT IN ('rejected')",
    [requirement_id, member_id]
  );
  if (existingRes.rows.length > 0) {
    return NextResponse.json({ error: "Ya existe una asignación para este miembro y requerimiento" }, { status: 400 });
  }

  const assignment = await createRequirementAssignment({
    requirement_id,
    project_id: projectId,
    member_id,
    proposed_cost: Number(proposed_cost),
  });

  // Notify member
  try {
    const userId = await getUserIdByMemberId(member_id);
    if (userId) {
      await createNotification({
        user_id: userId,
        type: "project_invitation",
        title: "Nueva asignación de requerimiento",
        message: `El creador del proyecto "${project.title}" te ha asignado un nuevo requerimiento. Revisa la propuesta de costo y envía tu contrapropuesta.`,
        link: `/dashboard/projects/${projectId}`,
      });
    }
  } catch { /* don't fail */ }

  return NextResponse.json({ data: assignment }, { status: 201 });
}

// PATCH — member submits counter-cost OR creator accepts/rejects
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  const { assignment_id, action } = body;
  if (!assignment_id || !action) {
    return NextResponse.json({ error: "assignment_id and action are required" }, { status: 400 });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // action: "counter" — member submits their cost
  if (action === "counter") {
    const { member_cost } = body;
    if (member_cost == null || Number(member_cost) <= 0) {
      return NextResponse.json({ error: "member_cost is required and must be positive" }, { status: 400 });
    }

    // Verify caller is the assigned member
    const userRes = await query("SELECT member_id FROM users WHERE id = $1", [auth.userId]);
    const memberId = userRes.rows[0]?.member_id;
    if (!memberId) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    // Verify the assignment belongs to this member
    const assignRes = await query(
      "SELECT * FROM requirement_assignments WHERE id = $1 AND member_id = $2 AND project_id = $3",
      [assignment_id, memberId, projectId]
    );
    if (assignRes.rows.length === 0) {
      return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
    }

    const updated = await submitAssignmentCost(assignment_id, Number(member_cost));
    if (!updated) {
      return NextResponse.json({ error: "La asignación no está disponible para contrapropuesta" }, { status: 400 });
    }

    // Notify project owner
    try {
      const ownerRes = await query(
        `SELECT u.id FROM users u
         JOIN clients c ON LOWER(c.email) = LOWER(u.email)
         WHERE c.id = $1 LIMIT 1`,
        [project.client_id]
      );
      if (ownerRes.rows[0]) {
        const memberRes = await query("SELECT name FROM members WHERE id = $1", [memberId]);
        const memberName = memberRes.rows[0]?.name || "Un miembro";
        await createNotification({
          user_id: ownerRes.rows[0].id,
          type: "project_invitation",
          title: "Contrapropuesta de asignación",
          message: `${memberName} ha enviado su contrapropuesta de costo ($${Number(member_cost).toFixed(2)}) para un requerimiento del proyecto "${project.title}".`,
          link: `/dashboard/projects/${projectId}`,
        });
      }
    } catch { /* don't fail */ }

    return NextResponse.json({ data: updated });
  }

  // action: "accept" or "reject" — creator resolves assignment
  if (action === "accept" || action === "reject") {
    // Only owner or admin
    if (auth.role !== "admin") {
      const clientRes = await query(
        "SELECT id FROM clients WHERE LOWER(email) = LOWER($1)",
        [auth.email]
      );
      if (!clientRes.rows[0] || clientRes.rows[0].id !== project.client_id) {
        return NextResponse.json({ error: "Solo el creador puede resolver" }, { status: 403 });
      }
    }

    const status = action === "accept" ? "accepted" : "rejected";
    const resolved = await resolveAssignment(assignment_id, status);
    if (!resolved) {
      return NextResponse.json({ error: "La asignación no está en estado 'contrapropuesta'" }, { status: 400 });
    }

    // Notify the member
    try {
      const userId = await getUserIdByMemberId(resolved.member_id);
      if (userId) {
        await createNotification({
          user_id: userId,
          type: "project_invitation",
          title: status === "accepted" ? "Asignación aceptada" : "Asignación rechazada",
          message: status === "accepted"
            ? `Tu contrapropuesta para el proyecto "${project.title}" ha sido aceptada. El requerimiento fue añadido a tu lista.`
            : `Tu contrapropuesta para el proyecto "${project.title}" ha sido rechazada.`,
          link: `/dashboard/projects/${projectId}`,
        });
      }
    } catch { /* don't fail */ }

    return NextResponse.json({ data: resolved });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
