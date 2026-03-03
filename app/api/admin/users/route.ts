import { NextRequest, NextResponse } from "next/server";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";
import { listUsers } from "@/lib/services/user-service";

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  const url = req.nextUrl.searchParams;
  const rolesParam = url.get("roles");
  const data = await listUsers({
    page: Number(url.get("page")) || 1,
    per_page: Number(url.get("per_page")) || 20,
    role: url.get("role") || undefined,
    roles: rolesParam ? rolesParam.split(",") : undefined,
    search: url.get("search") || undefined,
  });

  return NextResponse.json(data);
}
