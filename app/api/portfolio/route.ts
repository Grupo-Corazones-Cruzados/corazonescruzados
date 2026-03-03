import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listAllPortfolioItems } from "@/lib/services/cv-portfolio-service";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const search = req.nextUrl.searchParams.get("search") || undefined;
  const items = await listAllPortfolioItems({ search });
  return NextResponse.json({ data: items });
}
