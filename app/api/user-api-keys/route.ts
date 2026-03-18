import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

/** GET  → list all API keys for the current user (api_key masked) */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const result = await query(
    `SELECT id, service,
            CONCAT(LEFT(api_key, 6), '••••••') AS api_key_masked,
            config, created_at, updated_at
     FROM user_api_keys
     WHERE user_id = $1
     ORDER BY service ASC`,
    [auth.userId]
  );

  return NextResponse.json({ data: result.rows });
}
