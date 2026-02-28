import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
} from "@/lib/services/project-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const reqs = await getProjectRequirements(Number(id));
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
    ...body,
  });
  return NextResponse.json({ data: req_ }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

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

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.requirement_id) {
    return NextResponse.json(
      { error: "requirement_id is required" },
      { status: 400 }
    );
  }

  const ok = await deleteRequirement(body.requirement_id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
