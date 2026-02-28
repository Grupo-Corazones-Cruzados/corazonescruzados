import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getTicketsForCalendar } from "@/lib/services/ticket-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const from = url.get("from");
  const to = url.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to query params are required" },
      { status: 400 }
    );
  }

  const data = await getTicketsForCalendar({
    from,
    to,
    member_id: url.get("member_id") ? Number(url.get("member_id")) : undefined,
  });

  return NextResponse.json({ data });
}
