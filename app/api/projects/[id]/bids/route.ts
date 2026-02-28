import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectBids,
  createBid,
  updateBidStatus,
} from "@/lib/services/project-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const bids = await getProjectBids(Number(id));
  return NextResponse.json({ data: bids });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.member_id || !body.proposal || body.bid_amount == null) {
    return NextResponse.json(
      { error: "member_id, proposal, and bid_amount are required" },
      { status: 400 }
    );
  }

  const bid = await createBid({
    project_id: Number(id),
    ...body,
  });
  return NextResponse.json({ data: bid }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.bid_id || !body.status) {
    return NextResponse.json(
      { error: "bid_id and status are required" },
      { status: 400 }
    );
  }

  const bid = await updateBidStatus(body.bid_id, body.status);
  if (!bid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: bid });
}
