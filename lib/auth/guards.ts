import { NextRequest, NextResponse } from "next/server";
import { verifyTokenWithInvalidation, type TokenPayload } from "./jwt";
import type { UserRole } from "@/lib/types";

/** Extract and verify the JWT from a request. Returns null if invalid. */
export async function authenticateRequest(
  req: NextRequest
): Promise<TokenPayload | null> {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyTokenWithInvalidation(token);
}

/** Require a valid auth token. Returns 401 JSON if missing/invalid. */
export async function requireAuth(
  req: NextRequest
): Promise<TokenPayload | NextResponse> {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/** Require a specific role. Returns 403 JSON if insufficient. */
export async function requireRole(
  req: NextRequest,
  ...roles: UserRole[]
): Promise<TokenPayload | NextResponse> {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;
  if (!roles.includes(result.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

/** Helper to check if requireAuth/requireRole returned an error response */
export function isErrorResponse(
  result: TokenPayload | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
