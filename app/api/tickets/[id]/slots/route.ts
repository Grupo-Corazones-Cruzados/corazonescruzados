import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getTicketSlots,
  addTicketSlot,
  updateTicketSlot,
  deleteTicketSlot,
} from "@/lib/services/ticket-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const slots = await getTicketSlots(Number(id));
  return NextResponse.json({ data: slots });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.date || !body.start_time || !body.end_time) {
    return NextResponse.json(
      { error: "date, start_time, and end_time are required" },
      { status: 400 }
    );
  }

  const slot = await addTicketSlot({
    ticket_id: Number(id),
    date: body.date,
    start_time: body.start_time,
    end_time: body.end_time,
  });

  return NextResponse.json({ data: slot }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  if (!body.slot_id) {
    return NextResponse.json({ error: "slot_id is required" }, { status: 400 });
  }

  const slot = await updateTicketSlot(body.slot_id, {
    status: body.status,
    actual_duration: body.actual_duration,
    notes: body.notes,
  });

  if (!slot) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  return NextResponse.json({ data: slot });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const slotId = req.nextUrl.searchParams.get("slot_id");
  if (!slotId) {
    return NextResponse.json({ error: "slot_id is required" }, { status: 400 });
  }

  const deleted = await deleteTicketSlot(Number(slotId));
  if (!deleted) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
