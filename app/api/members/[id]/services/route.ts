import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isErrorResponse } from "@/lib/auth/guards";
import { query, transaction } from "@/lib/db";
import type { Service } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const result = await query<Service>(
    `SELECT s.* FROM services s
     JOIN member_services ms ON ms.service_id = s.id
     WHERE ms.member_id = $1 AND s.is_active = true
     ORDER BY s.name`,
    [Number(id)]
  );

  return NextResponse.json({ data: result.rows });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  const memberId = Number(id);

  // Only allow admin or the member themselves
  if (auth.role !== "admin") {
    const userResult = await query(
      "SELECT member_id FROM users WHERE id = $1",
      [auth.userId]
    );
    const userMemberId = userResult.rows[0]?.member_id;
    if (!userMemberId || Number(userMemberId) !== memberId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { service_ids } = await req.json();

  if (!Array.isArray(service_ids)) {
    return NextResponse.json(
      { error: "service_ids must be an array" },
      { status: 400 }
    );
  }

  const services = await transaction(async (client) => {
    // Remove all existing associations
    await client.query(
      "DELETE FROM member_services WHERE member_id = $1",
      [memberId]
    );

    // Insert new associations
    for (const serviceId of service_ids) {
      await client.query(
        "INSERT INTO member_services (member_id, service_id) VALUES ($1, $2)",
        [memberId, serviceId]
      );
    }

    // Return the updated list
    const result = await client.query<Service>(
      `SELECT s.* FROM services s
       JOIN member_services ms ON ms.service_id = s.id
       WHERE ms.member_id = $1 AND s.is_active = true
       ORDER BY s.name`,
      [memberId]
    );

    return result.rows;
  });

  return NextResponse.json({ data: services });
}
