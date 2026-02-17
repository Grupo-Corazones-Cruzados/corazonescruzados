import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/member/paquete-asignaciones/[id]/pre-confirmar - Pre-confirm completion
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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
    const asigId = parseInt(id);

    if (isNaN(asigId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Verify ownership and state
    const asignacionResult = await query(
      `SELECT pa.* FROM paquete_asignaciones pa
       WHERE pa.id = $1 AND pa.id_miembro = $2
       AND pa.estado IN ('aprobado', 'en_progreso')`,
      [asigId, idMiembro]
    );

    if (asignacionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Asignacion no encontrada o no se puede pre-confirmar" },
        { status: 404 }
      );
    }

    const asignacion = asignacionResult.rows[0];
    const body = await request.json();
    const { contenido } = body;

    // Auto-consume remaining hours: set horas_consumidas = horas_asignadas
    const horasRestantes = Number(asignacion.horas_asignadas) - Number(asignacion.horas_consumidas);

    // Update asignacion to pre_confirmado
    await query(
      `UPDATE paquete_asignaciones
       SET estado = 'pre_confirmado',
           fecha_pre_confirmacion = NOW(),
           horas_consumidas = horas_asignadas
       WHERE id = $1`,
      [asigId]
    );

    // Insert pre-confirmation avance (with remaining hours auto-consumed)
    await query(
      `INSERT INTO paquete_avances (id_asignacion, autor_tipo, id_autor, contenido, horas_reportadas, es_pre_confirmacion)
       VALUES ($1, 'miembro', $2, $3, 0, true)`,
      [
        asigId,
        tokenData.userId,
        contenido || "Trabajo completado. Pendiente confirmación del cliente.",
      ]
    );

    return NextResponse.json({ success: true, horas_auto_consumidas: horasRestantes });
  } catch (error) {
    console.error("Error pre-confirming:", error);
    return NextResponse.json(
      { error: "Error al pre-confirmar" },
      { status: 500 }
    );
  }
}
