import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listTickets, createTicket } from "@/lib/services/ticket-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listTickets({
    page: Number(url.get("page")) || 1,
    per_page: Number(url.get("per_page")) || 20,
    status: url.get("status") || undefined,
    client_id: url.get("client_id") ? Number(url.get("client_id")) : undefined,
    member_id: url.get("member_id") ? Number(url.get("member_id")) : undefined,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  if (!body.client_id || !body.title) {
    return NextResponse.json(
      { error: "client_id and title are required" },
      { status: 400 }
    );
  }

  try {
    const ticket = await createTicket(body);
    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (error) {
    console.error("Create ticket error:", error);
    return NextResponse.json(
      { error: "Error al crear ticket" },
      { status: 500 }
    );
  }
}
