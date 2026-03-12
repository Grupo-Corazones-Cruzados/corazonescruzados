import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getProjectBids,
  createBid,
  updateBidStatus,
  submitBidProposal,
  getProjectById,
  areAllRequirementsTaken,
  revokeNonAcceptedAccess,
} from "@/lib/services/project-service";
import { query } from "@/lib/db";

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
  const projectId = Number(id);
  const body = await req.json();

  // Case 1: Member with an "invited" bid submitting their proposal
  if (body.bid_id && body.proposal && body.bid_amount != null) {
    const bid = await submitBidProposal(body.bid_id, {
      proposal: body.proposal,
      bid_amount: body.bid_amount,
      requirement_ids: body.requirement_ids,
      work_dates: body.work_dates,
    });
    if (!bid) {
      return NextResponse.json(
        { error: "Bid not found or not in invited status" },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: bid });
  }

  // Case 2: New bid (regular flow)
  if (!body.member_id || !body.proposal || body.bid_amount == null) {
    return NextResponse.json(
      { error: "member_id, proposal, and bid_amount are required" },
      { status: 400 }
    );
  }

  const bid = await createBid({
    project_id: projectId,
    ...body,
  });
  return NextResponse.json({ data: bid }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();

  if (!body.bid_id || !body.status) {
    return NextResponse.json(
      { error: "bid_id and status are required" },
      { status: 400 }
    );
  }

  // Admin can always manage bids
  // Client can manage bids on their own projects
  if (auth.role === "client") {
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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

  const bid = await updateBidStatus(body.bid_id, body.status);
  if (!bid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // After accepting a bid, check if all requirements are now taken
  if (body.status === "accepted") {
    const allTaken = await areAllRequirementsTaken(projectId);
    if (allTaken) {
      // Revoke access for all non-accepted members
      await revokeNonAcceptedAccess(projectId);
    }
  }

  return NextResponse.json({ data: bid });
}
