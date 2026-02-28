import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listPurchases, createPurchase } from "@/lib/services/package-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listPurchases({
    page: url.get("page") ? Number(url.get("page")) : undefined,
    per_page: url.get("per_page") ? Number(url.get("per_page")) : undefined,
    client_id: url.get("client_id") ? Number(url.get("client_id")) : undefined,
    status: url.get("status") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.package_id || !body.client_id || !body.hours_total) {
    return NextResponse.json(
      { error: "package_id, client_id, and hours_total are required" },
      { status: 400 }
    );
  }

  const purchase = await createPurchase({
    ...body,
    user_id: auth.userId,
  });
  return NextResponse.json({ data: purchase }, { status: 201 });
}
