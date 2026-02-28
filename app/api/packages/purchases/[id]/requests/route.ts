import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  listRequests,
  createRequest,
  updateRequestStatus,
} from "@/lib/services/package-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const data = await listRequests(Number(id));
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

  if (!body.client_id || !body.title) {
    return NextResponse.json(
      { error: "client_id and title are required" },
      { status: 400 }
    );
  }

  const request = await createRequest({
    purchase_id: Number(id),
    ...body,
  });
  return NextResponse.json({ data: request }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.request_id || !body.status) {
    return NextResponse.json(
      { error: "request_id and status are required" },
      { status: 400 }
    );
  }

  const updated = await updateRequestStatus(body.request_id, body.status);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}
