import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  getMemberSchedules,
  setMemberSchedules,
} from "@/lib/services/member-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const schedules = await getMemberSchedules(Number(id));
  return NextResponse.json({ data: schedules });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const { schedules } = await req.json();

  if (!Array.isArray(schedules)) {
    return NextResponse.json(
      { error: "schedules must be an array" },
      { status: 400 }
    );
  }

  const result = await setMemberSchedules(Number(id), schedules);
  return NextResponse.json({ data: result });
}
