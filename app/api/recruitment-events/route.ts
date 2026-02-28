import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listEvents, createEvent } from "@/lib/services/recruitment-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const type = req.nextUrl.searchParams.get("type") || undefined;
  const data = await listEvents({ type });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  if (!body.title || !body.event_date || !body.type) {
    return NextResponse.json(
      { error: "title, event_date, and type are required" },
      { status: 400 }
    );
  }

  const event = await createEvent({ ...body, created_by: auth.userId });
  return NextResponse.json({ data: event }, { status: 201 });
}
