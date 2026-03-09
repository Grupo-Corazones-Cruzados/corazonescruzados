import { NextRequest, NextResponse } from "next/server";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";
import { promoteToMember } from "@/lib/services/user-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const user = await promoteToMember(id, {
      position_id: body.position_id ? Number(body.position_id) : undefined,
      hourly_rate: body.hourly_rate ? Number(body.hourly_rate) : undefined,
    });
    return NextResponse.json({ data: user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Promotion failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
