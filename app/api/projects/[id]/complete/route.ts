import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectById,
  updateProject,
  clearCompletionNotified,
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

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify owner
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

  const action = body.action;

  // 1. Request more requirements -> back to in_progress, must extend deadline
  if (action === "more_requirements") {
    if (!body.new_deadline) {
      return NextResponse.json(
        { error: "Debes especificar una nueva fecha fin" },
        { status: 400 }
      );
    }
    // New deadline must be after current deadline
    if (project.deadline && body.new_deadline <= project.deadline) {
      return NextResponse.json(
        { error: "La nueva fecha fin debe ser posterior a la actual" },
        { status: 400 }
      );
    }
    await updateProject(projectId, {
      status: "in_progress",
      deadline: body.new_deadline,
    });
    await clearCompletionNotified(projectId);
    return NextResponse.json({ message: "Proyecto actualizado a En Progreso" });
  }

  // 2. Confirm completion -> status stays in_progress until payment
  if (action === "confirm_completion") {
    // Status will change to "completed" when payment proof is uploaded
    return NextResponse.json({
      message: "Procede a realizar el pago para completar el proyecto",
      awaiting_payment: true,
    });
  }

  // 3. Request review time
  if (action === "request_review") {
    if (!body.review_deadline) {
      return NextResponse.json(
        { error: "Debes especificar una fecha de revisión" },
        { status: 400 }
      );
    }
    // Review deadline must be <= project deadline
    if (project.deadline && body.review_deadline > project.deadline) {
      return NextResponse.json(
        { error: "La fecha de revisión no puede ser posterior a la fecha fin del proyecto" },
        { status: 400 }
      );
    }
    await updateProject(projectId, { status: "review" });
    await query(
      "UPDATE projects SET review_deadline = $1 WHERE id = $2",
      [body.review_deadline, projectId]
    );
    await clearCompletionNotified(projectId);
    return NextResponse.json({ message: "Proyecto en revisión" });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
