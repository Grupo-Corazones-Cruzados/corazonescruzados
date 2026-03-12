import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getCancellationRequests,
  createCancellationRequest,
  getCancellationRequestCount,
  hasPendingCancellation,
  getProjectById,
  getAcceptedMembers,
  resolveCancellationRequest,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";
import { MAX_CANCELLATION_REQUESTS } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const requests = await getCancellationRequests(projectId);

  // Also return count and pending status for UI
  const count = await getCancellationRequestCount(projectId);
  const hasPending = await hasPendingCancellation(projectId);
  const members = await getAcceptedMembers(projectId);

  return NextResponse.json({
    data: requests,
    total_requests: count,
    has_pending: hasPending,
    max_requests: MAX_CANCELLATION_REQUESTS,
    total_accepted_members: members.length,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  if (!body.reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only project owner can request cancellation
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

  // Check if there's already a pending request
  const pending = await hasPendingCancellation(projectId);
  if (pending) {
    return NextResponse.json(
      { error: "Ya existe una solicitud de cancelación pendiente" },
      { status: 400 }
    );
  }

  // Check max cancellation requests (only for non-admin)
  if (auth.role !== "admin") {
    const count = await getCancellationRequestCount(projectId);
    if (count >= MAX_CANCELLATION_REQUESTS) {
      return NextResponse.json(
        { error: "Se ha alcanzado el máximo de solicitudes de cancelación. Solo un administrador puede cancelar este proyecto." },
        { status: 400 }
      );
    }
  }

  const request = await createCancellationRequest({
    project_id: projectId,
    requested_by: auth.userId,
    reason: body.reason,
  });

  // Notify all accepted members to vote
  const members = await getAcceptedMembers(projectId);
  for (const member of members) {
    try {
      const userRes = await query(
        "SELECT id FROM users WHERE member_id = $1 LIMIT 1",
        [member.id]
      );
      if (userRes.rows[0]) {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, link)
           VALUES ($1, 'cancellation_requested', $2, $3, $4)`,
          [
            userRes.rows[0].id,
            `Solicitud de cancelación: ${project.title}`,
            `El creador del proyecto "${project.title}" ha solicitado su cancelación. Tu voto es necesario.`,
            `/dashboard/projects/${projectId}`,
          ]
        );
      }
    } catch {
      // Don't fail
    }
  }

  return NextResponse.json({ data: request }, { status: 201 });
}

// PATCH: Admin-only override (for when 3+ requests exhausted)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.request_id || !body.status) {
    return NextResponse.json(
      { error: "request_id and status are required" },
      { status: 400 }
    );
  }

  const resolved = await resolveCancellationRequest(
    body.request_id,
    body.status,
    auth.userId
  );

  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: resolved });
}
