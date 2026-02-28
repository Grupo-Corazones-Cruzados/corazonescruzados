import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getCancellationRequests,
  createCancellationRequest,
  resolveCancellationRequest,
} from "@/lib/services/project-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const requests = await getCancellationRequests(Number(id));
  return NextResponse.json({ data: requests });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  const request = await createCancellationRequest({
    project_id: Number(id),
    requested_by: auth.userId,
    reason: body.reason,
  });

  return NextResponse.json({ data: request }, { status: 201 });
}

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
