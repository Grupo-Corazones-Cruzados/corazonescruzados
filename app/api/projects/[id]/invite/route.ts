import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getProjectById, inviteMembers, areAllRequirementsTaken } from "@/lib/services/project-service";
import { query } from "@/lib/db";
import { sendProjectInvitationEmail } from "@/lib/integrations/resend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  if (!Array.isArray(body.member_ids) || body.member_ids.length === 0) {
    return NextResponse.json(
      { error: "member_ids array is required" },
      { status: 400 }
    );
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only project owner (client) or admin can invite
  if (auth.role === "client") {
    const clientRes = await query(
      "SELECT id FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [auth.email]
    );
    if (!clientRes.rows[0] || clientRes.rows[0].id !== project.client_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If project is confirmed, only allow invite if untaken requirements exist
  if (project.confirmed_at) {
    const allTaken = await areAllRequirementsTaken(projectId);
    if (allTaken) {
      return NextResponse.json(
        { error: "Todos los requerimientos ya tienen miembros asignados" },
        { status: 400 }
      );
    }
  }

  const bids = await inviteMembers(projectId, body.member_ids);

  // Send notifications and emails to invited members
  for (const bid of bids) {
    try {
      // Get member info for email
      const memberRes = await query(
        `SELECT m.name, m.email, u.id AS user_id
         FROM members m
         LEFT JOIN users u ON u.member_id = m.id
         WHERE m.id = $1`,
        [bid.member_id]
      );
      const member = memberRes.rows[0];
      if (!member) continue;

      // Create notification
      if (member.user_id) {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, 'project_invitation', $2, $3, $4)`,
          [
            member.user_id,
            `Invitación: ${project.title}`,
            `Has sido invitado al proyecto "${project.title}"`,
            `/dashboard/projects/${projectId}`,
          ]
        );
      }

      // Send email
      if (member.email) {
        await sendProjectInvitationEmail(
          member.email,
          member.name,
          project.title,
          project.client_name || "Cliente",
          projectId
        );
      }
    } catch {
      // Don't fail the whole request if a notification/email fails
    }
  }

  return NextResponse.json({ data: bids }, { status: 201 });
}
