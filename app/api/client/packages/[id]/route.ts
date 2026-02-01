import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/client/packages/[id] - Get package purchase detail for client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Get purchase with related data
    const purchaseResult = await query(
      `SELECT
        pp.*,
        json_build_object(
          'id', p.id,
          'nombre', p.nombre,
          'horas', p.horas,
          'descripcion', p.descripcion,
          'contenido', p.contenido
        ) as paquete,
        json_build_object(
          'id', m.id,
          'nombre', m.nombre,
          'foto', m.foto,
          'puesto', m.puesto,
          'costo', m.costo
        ) as miembro
      FROM package_purchases pp
      JOIN paquetes p ON pp.id_paquete = p.id
      JOIN miembros m ON pp.id_miembro = m.id
      WHERE pp.id = $1 AND pp.id_cliente = $2`,
      [purchaseId, tokenData.userId]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    const purchase = purchaseResult.rows[0];

    // Get sessions
    const sessionsResult = await query(
      `SELECT * FROM package_sessions
       WHERE id_purchase = $1
       ORDER BY fecha ASC, hora_inicio ASC`,
      [purchaseId]
    );

    // Get availability
    const availabilityResult = await query(
      `SELECT * FROM package_availability
       WHERE id_purchase = $1 AND activo = true
       ORDER BY dia_semana, hora_inicio`,
      [purchaseId]
    );

    return NextResponse.json({
      purchase,
      sessions: sessionsResult.rows,
      availability: availabilityResult.rows,
    });
  } catch (error) {
    console.error("Error fetching package detail:", error);
    return NextResponse.json(
      { error: "Error al cargar el detalle del paquete" },
      { status: 500 }
    );
  }
}

// PATCH /api/client/packages/[id] - Client cancels package (before approval)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const purchaseId = parseInt(id);
    const body = await request.json();
    const { action } = body;

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Verify ownership
    const purchaseResult = await query(
      `SELECT * FROM package_purchases WHERE id = $1 AND id_cliente = $2`,
      [purchaseId, tokenData.userId]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    const purchase = purchaseResult.rows[0];

    if (action === "cancel") {
      // Client can only cancel if still pending
      if (purchase.estado !== "pendiente" && purchase.estado !== "en_espera") {
        return NextResponse.json(
          { error: "Solo puedes cancelar paquetes pendientes o en espera" },
          { status: 400 }
        );
      }

      await query(
        `UPDATE package_purchases SET estado = 'cancelado' WHERE id = $1`,
        [purchaseId]
      );

      return NextResponse.json({ success: true, estado: "cancelado" });
    }

    return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Error al actualizar el paquete" },
      { status: 500 }
    );
  }
}
