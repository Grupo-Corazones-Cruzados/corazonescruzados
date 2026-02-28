import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "@/lib/auth/guards";
import { listClients, createClient } from "@/lib/services/client-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listClients({
    page: Number(url.get("page")) || 1,
    per_page: Number(url.get("per_page")) || 20,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "admin", "member");
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  if (!body.name || !body.email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  try {
    const client = await createClient(body);
    return NextResponse.json({ data: client }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique")) {
      return NextResponse.json(
        { error: "A client with this email already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
