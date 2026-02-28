import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listProducts, createProduct } from "@/lib/services/marketplace-service";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams;
  const data = await listProducts({
    active_only: url.get("active_only") !== "false",
    category: url.get("category") || undefined,
    search: url.get("search") || undefined,
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.name || body.price == null) {
    return NextResponse.json({ error: "name and price required" }, { status: 400 });
  }

  const product = await createProduct(body);
  return NextResponse.json({ data: product }, { status: 201 });
}
