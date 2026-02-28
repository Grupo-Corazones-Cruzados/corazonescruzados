import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listApplicants, createApplicant } from "@/lib/services/recruitment-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const data = await listApplicants({
    page: url.get("page") ? Number(url.get("page")) : undefined,
    per_page: url.get("per_page") ? Number(url.get("per_page")) : undefined,
    status: url.get("status") || undefined,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.first_name || !body.last_name || !body.email) {
    return NextResponse.json(
      { error: "first_name, last_name, and email are required" },
      { status: 400 }
    );
  }

  try {
    const applicant = await createApplicant(body);
    return NextResponse.json({ data: applicant }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }
}
