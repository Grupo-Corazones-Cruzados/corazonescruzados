import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  listAssignments,
  createAssignment,
  updateAssignmentStatus,
  listProgressUpdates,
  createProgressUpdate,
} from "@/lib/services/package-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const data = await listAssignments(Number(id));
  return NextResponse.json({ data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  // Create assignment or progress update depending on body fields
  if (body.member_id && body.hours_assigned) {
    const assignment = await createAssignment({
      request_id: Number(id),
      member_id: body.member_id,
      hours_assigned: body.hours_assigned,
    });
    return NextResponse.json({ data: assignment }, { status: 201 });
  }

  if (body.assignment_id && body.content) {
    const update = await createProgressUpdate({
      assignment_id: body.assignment_id,
      author_id: auth.userId,
      content: body.content,
      hours_logged: body.hours_logged,
    });
    return NextResponse.json({ data: update }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.assignment_id || !body.status) {
    return NextResponse.json(
      { error: "assignment_id and status are required" },
      { status: 400 }
    );
  }

  const updated = await updateAssignmentStatus(body.assignment_id, body.status);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}
