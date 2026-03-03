import { NextRequest, NextResponse } from "next/server";
import { requireRole, isErrorResponse } from "@/lib/auth/guards";
import { invalidateAllSessions } from "@/lib/services/user-service";

/** DELETE /api/admin/sessions — Invalidate all user sessions */
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, "admin");
  if (isErrorResponse(auth)) return auth;

  try {
    const count = await invalidateAllSessions();
    return NextResponse.json({
      message: `Todas las sesiones han sido invalidadas (${count} usuarios afectados)`,
    });
  } catch (error) {
    console.error("Invalidate sessions error:", error);
    return NextResponse.json(
      { error: "Error al invalidar sesiones" },
      { status: 500 }
    );
  }
}
