import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getCart, addToCart, updateCartItem, clearCart } from "@/lib/services/marketplace-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const data = await getCart(auth.userId);
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.product_id) {
    return NextResponse.json({ error: "product_id required" }, { status: 400 });
  }

  const item = await addToCart(auth.userId, body.product_id, body.quantity || 1);
  return NextResponse.json({ data: item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.item_id || body.quantity == null) {
    return NextResponse.json({ error: "item_id and quantity required" }, { status: 400 });
  }

  const item = await updateCartItem(body.item_id, auth.userId, body.quantity);
  return NextResponse.json({ data: item });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  await clearCart(auth.userId);
  return NextResponse.json({ message: "Cart cleared" });
}
