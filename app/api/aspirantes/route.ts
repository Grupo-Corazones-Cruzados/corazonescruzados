import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

// POST /api/aspirantes - Create an aspiring member record (1 per IP)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { motivo } = body;

    if (!motivo || !motivo.trim()) {
      return NextResponse.json(
        { error: "El motivo es requerido" },
        { status: 400 }
      );
    }

    const clientIp = getClientIP(request);

    // Check if this IP already submitted
    if (clientIp !== "unknown") {
      const existing = await query(
        "SELECT id FROM aspirantes WHERE ip_address = $1 LIMIT 1",
        [clientIp]
      );

      if (existing.rows.length > 0) {
        return NextResponse.json(
          {
            error: "Ya enviaste una solicitud anteriormente.",
            code: "ALREADY_SUBMITTED",
          },
          { status: 403 }
        );
      }
    }

    await query(
      `INSERT INTO aspirantes (motivo, ip_address) VALUES ($1, $2)`,
      [motivo.trim(), clientIp !== "unknown" ? clientIp : null]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating aspirante:", error);
    return NextResponse.json({ error: "Error al enviar" }, { status: 500 });
  }
}
