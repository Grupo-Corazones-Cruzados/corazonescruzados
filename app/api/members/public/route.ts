import { NextResponse } from "next/server";
import { listPublicMembers } from "@/lib/services/member-service";

export async function GET() {
  try {
    const members = await listPublicMembers();
    return NextResponse.json({ data: members });
  } catch (err) {
    console.error("GET /api/members/public error:", err);
    return NextResponse.json(
      { error: "Error al obtener miembros" },
      { status: 500 }
    );
  }
}
