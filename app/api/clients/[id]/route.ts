import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "@/lib/auth/guards";
import {
  getClientById,
  updateClient,
  deleteClient,
} from "@/lib/services/client-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const client = await getClientById(Number(id));
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ data: client });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "admin", "member");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();
  const client = await updateClient(Number(id), body);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ data: client });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const deleted = await deleteClient(Number(id));

  if (!deleted) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
