import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getClientsForMember } from "@/lib/services/client-member-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const clients = await getClientsForMember(Number(id));
  return NextResponse.json({ data: clients });
}
