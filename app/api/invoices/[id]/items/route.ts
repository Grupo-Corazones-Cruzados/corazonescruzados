import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  addInvoiceItem,
  deleteInvoiceItem,
} from "@/lib/services/invoice-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.description || body.quantity == null || body.unit_price == null) {
    return NextResponse.json(
      { error: "description, quantity, and unit_price are required" },
      { status: 400 }
    );
  }

  const item = await addInvoiceItem({
    invoice_id: Number(id),
    ...body,
  });
  return NextResponse.json({ data: item }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();

  if (!body.item_id) {
    return NextResponse.json(
      { error: "item_id is required" },
      { status: 400 }
    );
  }

  const ok = await deleteInvoiceItem(body.item_id, Number(id));
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
