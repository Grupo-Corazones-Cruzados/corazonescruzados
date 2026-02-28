import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getTicketServices,
  addTicketService,
  deleteTicketService,
} from "@/lib/services/ticket-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const services = await getTicketServices(Number(id));
  return NextResponse.json({ data: services });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.assigned_hours || !body.hourly_cost) {
    return NextResponse.json(
      { error: "assigned_hours and hourly_cost are required" },
      { status: 400 }
    );
  }

  const svc = await addTicketService({
    ticket_id: Number(id),
    service_id: body.service_id || undefined,
    assigned_hours: body.assigned_hours,
    hourly_cost: body.hourly_cost,
  });

  return NextResponse.json({ data: svc }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const serviceId = req.nextUrl.searchParams.get("service_id");
  if (!serviceId) {
    return NextResponse.json(
      { error: "service_id query param is required" },
      { status: 400 }
    );
  }

  const deleted = await deleteTicketService(Number(serviceId));
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
