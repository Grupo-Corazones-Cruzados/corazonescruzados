import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getSupportTicket, updateTicketStatus } from "@/lib/services/support-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const ticket = await getSupportTicket(Number(id));
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  // Only the owner or admin can view
  if (ticket.user_id !== auth.userId && auth.role !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
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
  const ticket = await getSupportTicket(Number(id));
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }

  const { status } = await req.json();

  // Only admin can change status, or owner can close
  const isOwner = ticket.user_id === auth.userId;
  if (auth.role !== "admin" && !(isOwner && status === "closed")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const validStatuses = ["open", "in_progress", "resolved", "closed"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const updated = await updateTicketStatus(Number(id), status);
  return NextResponse.json({ data: updated });
}
