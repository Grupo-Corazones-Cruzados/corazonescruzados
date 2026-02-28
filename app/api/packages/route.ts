import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { listPackages, createPackage } from "@/lib/services/package-service";

export async function GET(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get("active_only") !== "false";
  const data = await listPackages(activeOnly);
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  if (auth.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.name || body.price == null || body.hours == null) {
    return NextResponse.json(
      { error: "name, price, and hours are required" },
      { status: 400 }
    );
  }

  const pkg = await createPackage(body);
  return NextResponse.json({ data: pkg }, { status: 201 });
}
