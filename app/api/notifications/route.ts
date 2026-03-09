import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import {
  listNotifications,
  countUnread,
  markAllAsRead,
} from "@/lib/services/notification-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const [notifications, unread_count] = await Promise.all([
    listNotifications(auth.userId),
    countUnread(auth.userId),
  ]);

  return NextResponse.json({ data: notifications, unread_count });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  if (body.mark_all_read) {
    const count = await markAllAsRead(auth.userId);
    return NextResponse.json({ data: { updated: count } });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
