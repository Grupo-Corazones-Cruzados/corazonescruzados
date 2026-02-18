import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess } from "@/lib/reclutamiento";

// PATCH /api/reclutamiento/eventos/[id]/participacion - Toggle participation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { id_invitacion, participo } = body;

    if (!id_invitacion || typeof participo !== "boolean") {
      return NextResponse.json(
        { error: "ID de invitación y participación requeridos" },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE evento_invitaciones
       SET participo = $1
       WHERE id = $2 AND id_evento = $3
       RETURNING *`,
      [participo, id_invitacion, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invitación no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ invitacion: result.rows[0] });
  } catch (error) {
    console.error("Error updating participación:", error);
    return NextResponse.json(
      { error: "Error al actualizar participación" },
      { status: 500 }
    );
  }
}
