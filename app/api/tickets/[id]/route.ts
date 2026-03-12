import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getTicketById,
  updateTicket,
  deleteTicket,
} from "@/lib/services/ticket-service";
import { sendTicketStatusChangeEmail } from "@/lib/integrations/resend";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const ticket = await getTicketById(Number(id));

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ data: ticket });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();
  const ticket = await updateTicket(Number(id), body);

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Send email notification when member changes status to completed/cancelled/withdrawn
  const notifyStatuses = ["completed", "cancelled", "withdrawn"];
  if (body.status && notifyStatuses.includes(body.status)) {
    const full = await getTicketById(Number(id));
    if (full?.client_email) {
      try {
        await sendTicketStatusChangeEmail(
          full.client_email,
          full.client_name || "Cliente",
          full.id,
          full.title || "Sin título",
          full.member_name || "Miembro",
          body.status,
          body.cancellation_reason || undefined
        );
      } catch {
        // Email failure should not block the status update
      }
    }
  }

  return NextResponse.json({ data: ticket });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const deleted = await deleteTicket(Number(id));

  if (!deleted) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
