import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getTicketById,
  getTicketSlots,
  addTicketSlot,
  updateTicketSlot,
  deleteTicketSlot,
  replaceTicketSlots,
} from "@/lib/services/ticket-service";
import { sendTicketWorkDaysUpdatedEmail } from "@/lib/integrations/resend";
import { formatDate } from "@/lib/utils";

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

// Replace all work days + notify client
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.dates || !Array.isArray(body.dates) || body.dates.length === 0) {
    return NextResponse.json({ error: "dates array is required" }, { status: 400 });
  }
  if (!body.reason || !body.reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  try {
    const ticket = await getTicketById(Number(id));
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const slots = await replaceTicketSlots(Number(id), body.dates);

    // Send email to client
    if (ticket.client_email) {
      const formattedDates = body.dates.map((d: string) => formatDate(d));
      await sendTicketWorkDaysUpdatedEmail(
        ticket.client_email,
        ticket.client_name || "Cliente",
        ticket.id,
        ticket.title || `Ticket #${ticket.id}`,
        ticket.member_name || "Miembro",
        body.reason.trim(),
        formattedDates
      ).catch(() => { /* silent email error */ });
    }

    return NextResponse.json({ data: slots });
  } catch (error) {
    console.error("Replace slots error:", error);
    return NextResponse.json({ error: "Error al actualizar días" }, { status: 500 });
  }
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
