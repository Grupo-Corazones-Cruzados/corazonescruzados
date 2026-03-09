import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getOrderWithItems, updateOrderStatus } from "@/lib/services/marketplace-service";
import { query } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const order = await getOrderWithItems(Number(id));
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: order });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.status) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }

  const order = await updateOrderStatus(Number(id), body.status, body);
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: order });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const orderId = Number(id);

  // Verify the order belongs to this user (admins can delete any)
  const check = await query(
    "SELECT id, user_id FROM orders WHERE id = $1",
    [orderId]
  );
  if (!check.rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (auth.role !== "admin" && check.rows[0].user_id !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await query("DELETE FROM orders WHERE id = $1", [orderId]);

  return NextResponse.json({ message: "Pedido eliminado" });
}
