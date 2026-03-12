import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getAllRequirementItems,
  createRequirementItem,
  updateRequirementItem,
  deleteRequirementItem,
  reorderRequirementItems,
  getProjectRequirements,
} from "@/lib/services/project-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const reqs = await getProjectRequirements(Number(id));
  const reqIds = reqs.map((r) => r.id);
  const items = await getAllRequirementItems(reqIds);
  return NextResponse.json({ data: items });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.requirement_id || !body.title) {
    return NextResponse.json(
      { error: "requirement_id and title are required" },
      { status: 400 }
    );
  }

  const item = await createRequirementItem({
    requirement_id: body.requirement_id,
    title: body.title,
  });
  return NextResponse.json({ data: item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  // Reorder
  if (body.requirement_id && body.ordered_ids) {
    await reorderRequirementItems(body.requirement_id, body.ordered_ids);
    return NextResponse.json({ message: "Reordered" });
  }

  // Update single item
  if (!body.item_id) {
    return NextResponse.json({ error: "item_id is required" }, { status: 400 });
  }

  const updated = await updateRequirementItem(body.item_id, {
    title: body.title,
    is_completed: body.is_completed,
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.item_id) {
    return NextResponse.json({ error: "item_id is required" }, { status: 400 });
  }

  const ok = await deleteRequirementItem(body.item_id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ message: "Deleted" });
}
