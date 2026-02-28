import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { updateUserProfile } from "@/lib/services/user-service";

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();

  const user = await updateUserProfile(auth.userId, {
    first_name: body.first_name,
    last_name: body.last_name,
    phone: body.phone,
    avatar_url: body.avatar_url,
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}
