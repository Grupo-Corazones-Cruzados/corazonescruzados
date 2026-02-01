import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/member/packages/[id]/availability - Get availability for a package
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get member ID
    const userResult = await query(
      "SELECT id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].id_miembro) {
      return NextResponse.json(
        { error: "No eres un miembro" },
        { status: 403 }
      );
    }

    const idMiembro = userResult.rows[0].id_miembro;
    const { id } = await params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Verify ownership
    const purchaseResult = await query(
      `SELECT id FROM package_purchases WHERE id = $1 AND id_miembro = $2`,
      [purchaseId, idMiembro]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    // Get availability
    const availabilityResult = await query(
      `SELECT * FROM package_availability
       WHERE id_purchase = $1
       ORDER BY dia_semana, hora_inicio`,
      [purchaseId]
    );

    return NextResponse.json({ availability: availabilityResult.rows });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Error al cargar la disponibilidad" },
      { status: 500 }
    );
  }
}

// POST /api/member/packages/[id]/availability - Set availability slots
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get member ID
    const userResult = await query(
      "SELECT id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].id_miembro) {
      return NextResponse.json(
        { error: "No eres un miembro" },
        { status: 403 }
      );
    }

    const idMiembro = userResult.rows[0].id_miembro;
    const { id } = await params;
    const purchaseId = parseInt(id);
    const body = await request.json();
    const { slots } = body;

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    if (!slots || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "Los slots son requeridos" },
        { status: 400 }
      );
    }

    // Verify ownership
    const purchaseResult = await query(
      `SELECT id FROM package_purchases WHERE id = $1 AND id_miembro = $2`,
      [purchaseId, idMiembro]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    // Delete existing availability and insert new ones
    await query(`DELETE FROM package_availability WHERE id_purchase = $1`, [
      purchaseId,
    ]);

    for (const slot of slots) {
      await query(
        `INSERT INTO package_availability (id_purchase, dia_semana, hora_inicio, hora_fin, activo)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id_purchase, dia_semana, hora_inicio) DO UPDATE
         SET hora_fin = $4, activo = $5`,
        [
          purchaseId,
          slot.dia_semana,
          slot.hora_inicio,
          slot.hora_fin,
          slot.activo !== false,
        ]
      );
    }

    // Fetch updated availability
    const availabilityResult = await query(
      `SELECT * FROM package_availability
       WHERE id_purchase = $1
       ORDER BY dia_semana, hora_inicio`,
      [purchaseId]
    );

    return NextResponse.json({
      success: true,
      availability: availabilityResult.rows,
    });
  } catch (error) {
    console.error("Error setting availability:", error);
    return NextResponse.json(
      { error: "Error al configurar la disponibilidad" },
      { status: 500 }
    );
  }
}

// DELETE /api/member/packages/[id]/availability - Delete a specific availability slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get member ID
    const userResult = await query(
      "SELECT id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].id_miembro) {
      return NextResponse.json(
        { error: "No eres un miembro" },
        { status: 403 }
      );
    }

    const idMiembro = userResult.rows[0].id_miembro;
    const { id } = await params;
    const purchaseId = parseInt(id);

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");

    if (isNaN(purchaseId) || !slotId) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Verify ownership
    const purchaseResult = await query(
      `SELECT id FROM package_purchases WHERE id = $1 AND id_miembro = $2`,
      [purchaseId, idMiembro]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    // Delete specific slot
    await query(
      `DELETE FROM package_availability WHERE id = $1 AND id_purchase = $2`,
      [parseInt(slotId), purchaseId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting availability slot:", error);
    return NextResponse.json(
      { error: "Error al eliminar el slot" },
      { status: 500 }
    );
  }
}
