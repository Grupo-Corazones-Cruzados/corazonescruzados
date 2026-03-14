import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "member") {
    return NextResponse.json({ error: "Solo miembros pueden auto-asignarse" }, { status: 403 });
  }

  const { id } = await params;
  const projectId = Number(id);
  const body = await req.json();
  const { requirement_id, bid_id } = body;

  if (!requirement_id || !bid_id) {
    return NextResponse.json({ error: "requirement_id and bid_id required" }, { status: 400 });
  }

  // Verify the bid belongs to this member and project
  const userRes = await query("SELECT member_id FROM users WHERE id = $1", [auth.userId]);
  const memberId = userRes.rows[0]?.member_id;
  if (!memberId) {
    return NextResponse.json({ error: "No member profile" }, { status: 400 });
  }

  const bidRes = await query(
    "SELECT id, requirement_ids FROM project_bids WHERE id = $1 AND project_id = $2 AND member_id = $3 AND status = 'accepted'",
    [bid_id, projectId, memberId]
  );
  if (bidRes.rows.length === 0) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }

  const currentReqIds: number[] = bidRes.rows[0].requirement_ids || [];
  if (currentReqIds.includes(requirement_id)) {
    return NextResponse.json({ error: "Ya tienes asignado este requerimiento" }, { status: 409 });
  }

  // Check requirement is not already taken by another accepted bid
  const takenRes = await query(
    `SELECT id FROM project_bids
     WHERE project_id = $1 AND status = 'accepted' AND $2 = ANY(requirement_ids) AND id != $3`,
    [projectId, requirement_id, bid_id]
  );
  if (takenRes.rows.length > 0) {
    return NextResponse.json({ error: "Requerimiento ya asignado a otro miembro" }, { status: 409 });
  }

  // Add requirement_id to the bid's requirement_ids
  await query(
    `UPDATE project_bids
     SET requirement_ids = array_append(requirement_ids, $1)
     WHERE id = $2`,
    [requirement_id, bid_id]
  );

  return NextResponse.json({ message: "Requerimiento asignado" });
}
