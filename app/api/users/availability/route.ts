import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import {
  getMemberSchedules,
  setMemberSchedules,
  getScheduleExceptions,
} from "@/lib/services/member-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  // Get member_id for the current user
  const userResult = await query(
    "SELECT member_id FROM users WHERE id = $1",
    [auth.userId]
  );
  const memberId = userResult.rows[0]?.member_id;

  if (!memberId) {
    return NextResponse.json(
      { error: "No member profile linked" },
      { status: 400 }
    );
  }

  const [schedules, exceptions] = await Promise.all([
    getMemberSchedules(memberId),
    getScheduleExceptions(memberId),
  ]);

  return NextResponse.json({ data: { schedules, exceptions } });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const userResult = await query(
    "SELECT member_id FROM users WHERE id = $1",
    [auth.userId]
  );
  const memberId = userResult.rows[0]?.member_id;

  if (!memberId) {
    return NextResponse.json(
      { error: "No member profile linked" },
      { status: 400 }
    );
  }

  const { schedules } = await req.json();

  if (!Array.isArray(schedules)) {
    return NextResponse.json(
      { error: "schedules must be an array" },
      { status: 400 }
    );
  }

  const result = await setMemberSchedules(memberId, schedules);
  return NextResponse.json({ data: result });
}
