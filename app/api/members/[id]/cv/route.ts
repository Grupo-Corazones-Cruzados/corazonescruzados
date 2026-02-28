import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { getCvProfile, upsertCvProfile } from "@/lib/services/cv-portfolio-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = await getCvProfile(Number(id));
  return NextResponse.json({ data: profile });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json();
  const profile = await upsertCvProfile(Number(id), body);
  return NextResponse.json({ data: profile });
}
