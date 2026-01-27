import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/confirm - Confirm or cancel participation (per-member)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { action } = body;

    if (!action || !["confirm", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    // Get user's member ID
    const userResult = await query(
      "SELECT id_miembro, rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].id_miembro) {
      return NextResponse.json({ error: "No eres un miembro" }, { status: 403 });
    }
    const miembroId = userResult.rows[0].id_miembro;

    // Find the member's accepted bid for this project
    const bidResult = await query(
      "SELECT id, estado, confirmado_por_miembro FROM project_bids WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada'",
      [projectId, miembroId]
    );

    if (bidResult.rows.length === 0) {
      return NextResponse.json({ error: "No tienes una postulación aceptada en este proyecto" }, { status: 400 });
    }

    const bid = bidResult.rows[0];

    if (action === "confirm") {
      if (bid.confirmado_por_miembro) {
        return NextResponse.json({ error: "Ya confirmaste tu participación" }, { status: 400 });
      }

      await query(
        "UPDATE project_bids SET confirmado_por_miembro = true, fecha_confirmacion = NOW() WHERE id = $1",
        [bid.id]
      );

      return NextResponse.json({ success: true, message: "Participación confirmada" });
    } else {
      // Cancel: member rejects the offered amount — set bid back to rechazada
      await query(
        "UPDATE project_bids SET estado = 'rechazada', confirmado_por_miembro = false WHERE id = $1",
        [bid.id]
      );

      return NextResponse.json({ success: true, message: "Has rechazado la oferta" });
    }
  } catch (error) {
    console.error("Error confirming participation:", error);
    return NextResponse.json({ error: "Error al procesar la confirmación" }, { status: 500 });
  }
}
