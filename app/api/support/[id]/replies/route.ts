import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getSupportTicket, getTicketReplies, createReply } from "@/lib/services/support-service";

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

  if (ticket.user_id !== auth.userId && auth.role !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const replies = await getTicketReplies(Number(id));
  return NextResponse.json({ data: replies });
}

export async function POST(
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

  // Only owner or admin can reply
  if (ticket.user_id !== auth.userId && auth.role !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  if (ticket.status === "closed") {
    return NextResponse.json({ error: "El ticket está cerrado" }, { status: 400 });
  }

  const { message, attachment_url } = await req.json();
  if (!message) {
    return NextResponse.json({ error: "El mensaje es requerido" }, { status: 400 });
  }

  const reply = await createReply({
    ticket_id: Number(id),
    user_id: auth.userId,
    message,
    attachment_url,
  });

  return NextResponse.json({ data: reply }, { status: 201 });
}
