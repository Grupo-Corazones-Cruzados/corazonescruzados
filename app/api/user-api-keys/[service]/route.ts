import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";

const VALID_SERVICES = ["zeptomail", "meta_whatsapp"] as const;

/** GET → check if user has configured API key for this service */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { service } = await params;

  if (!VALID_SERVICES.includes(service as typeof VALID_SERVICES[number])) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }

  const result = await query(
    `SELECT id, service,
            CONCAT(LEFT(api_key, 6), '••••••') AS api_key_masked,
            config, created_at, updated_at
     FROM user_api_keys
     WHERE user_id = $1 AND service = $2`,
    [auth.userId, service]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data: result.rows[0] });
}

/** PUT → create or update API key for a service */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { service } = await params;

  if (!VALID_SERVICES.includes(service as typeof VALID_SERVICES[number])) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }

  const body = await req.json();
  const { api_key, config } = body;

  if (!api_key || typeof api_key !== "string" || !api_key.trim()) {
    return NextResponse.json({ error: "api_key is required" }, { status: 400 });
  }

  // Validate service-specific config
  if (service === "meta_whatsapp") {
    const cfg = config || {};
    if (!cfg.phone_number_id || !cfg.business_account_id) {
      return NextResponse.json(
        { error: "phone_number_id and business_account_id are required for Meta WhatsApp" },
        { status: 400 }
      );
    }
  }

  const result = await query(
    `INSERT INTO user_api_keys (user_id, service, api_key, config)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, service) DO UPDATE
       SET api_key = EXCLUDED.api_key,
           config = EXCLUDED.config
     RETURNING id, service,
               CONCAT(LEFT(api_key, 6), '••••••') AS api_key_masked,
               config, created_at, updated_at`,
    [auth.userId, service, api_key.trim(), JSON.stringify(config || {})]
  );

  return NextResponse.json({ data: result.rows[0] });
}

/** DELETE → remove API key for a service */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  const auth = await requireRole(req, "client", "member", "admin");
  if (isErrorResponse(auth)) return auth;

  const { service } = await params;

  const result = await query(
    "DELETE FROM user_api_keys WHERE user_id = $1 AND service = $2",
    [auth.userId, service]
  );

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Deleted" });
}
