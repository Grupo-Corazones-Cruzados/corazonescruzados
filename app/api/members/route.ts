import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, isErrorResponse } from "@/lib/auth/guards";
import { listMembers, createMember } from "@/lib/services/member-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listMembers({
    page: Number(url.get("page")) || 1,
    per_page: Number(url.get("per_page")) || 20,
    active_only: url.get("active_only") !== "false",
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const member = await createMember(body);
  return NextResponse.json({ data: member }, { status: 201 });
}
