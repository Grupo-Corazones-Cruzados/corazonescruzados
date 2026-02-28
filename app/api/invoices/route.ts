import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listInvoices, createInvoice } from "@/lib/services/invoice-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listInvoices({
    page: url.get("page") ? Number(url.get("page")) : undefined,
    per_page: url.get("per_page") ? Number(url.get("per_page")) : undefined,
    status: url.get("status") || undefined,
    client_id: url.get("client_id") ? Number(url.get("client_id")) : undefined,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin" && auth.role !== "member") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.client_id || !body.items?.length) {
    return NextResponse.json(
      { error: "client_id and items are required" },
      { status: 400 }
    );
  }

  const invoice = await createInvoice(body);
  return NextResponse.json({ data: invoice }, { status: 201 });
}
