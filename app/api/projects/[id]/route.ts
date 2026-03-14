import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectById,
  updateProject,
  deleteProject,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const project = await getProjectById(Number(id));
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();
  const project = await updateProject(Number(id), body);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const project = await getProjectById(Number(id));
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Admin can always delete; member creator can delete if not confirmed
  let isMemberCreator = false;
  if (auth.role === "member") {
    const userRes = await query("SELECT member_id FROM users WHERE id = $1", [auth.userId]);
    const memberId = userRes.rows[0]?.member_id;
    isMemberCreator = memberId != null && project.assigned_member_id === memberId;
  }

  if (auth.role !== "admin" && !(isMemberCreator && !project.confirmed_at)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await deleteProject(Number(id));
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
