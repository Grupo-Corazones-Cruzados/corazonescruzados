import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectById,
  getProjectRequirements,
  getAcceptedMembers,
  confirmProject,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";
import { sendProjectConfirmedEmail } from "@/lib/integrations/resend";
import { formatCurrency } from "@/lib/utils";

export async function POST(
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

  if (project.confirmed_at) {
    return NextResponse.json(
      { error: "Project already confirmed" },
      { status: 400 }
    );
  }

  // Only project owner (client) or admin can confirm
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

  // Validate preconditions
  const members = await getAcceptedMembers(projectId);
  if (members.length === 0) {
    return NextResponse.json(
      { error: "No accepted bids" },
      { status: 400 }
    );
  }

  const reqs = await getProjectRequirements(projectId);
  if (reqs.length === 0) {
    return NextResponse.json(
      { error: "No requirements" },
      { status: 400 }
    );
  }

  const updatedProject = await confirmProject(projectId);
  const costStr = formatCurrency(updatedProject.final_cost);

  // Send emails to accepted members
  for (const member of members) {
    try {
      if (member.email) {
        await sendProjectConfirmedEmail(
          member.email,
          member.name,
          project.title,
          costStr,
          projectId
        );
      }
      // Notification
      const userRes = await query(
        "SELECT id FROM users WHERE member_id = $1 LIMIT 1",
        [member.id]
      );
      if (userRes.rows[0]) {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, 'project_confirmed', $2, $3, $4)`,
          [
            userRes.rows[0].id,
            `Proyecto confirmado: ${project.title}`,
            `El proyecto "${project.title}" ha sido confirmado. Costo final: ${costStr}`,
            `/dashboard/projects/${projectId}`,
          ]
        );
      }
    } catch {
      // Don't fail the whole request
    }
  }

  return NextResponse.json({ data: updatedProject });
}
