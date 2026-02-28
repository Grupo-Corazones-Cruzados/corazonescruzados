import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getEventInvitations,
  createInvitation,
  updateInvitationStatus,
} from "@/lib/services/recruitment-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const data = await getEventInvitations(Number(id));
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

  if (!body.applicant_id) {
    return NextResponse.json({ error: "applicant_id required" }, { status: 400 });
  }

  const invitation = await createInvitation(Number(id), body.applicant_id);
  return NextResponse.json({ data: invitation }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.invitation_id || !body.status) {
    return NextResponse.json(
      { error: "invitation_id and status required" },
      { status: 400 }
    );
  }

  const updated = await updateInvitationStatus(body.invitation_id, body.status);
  return NextResponse.json({ data: updated });
}
