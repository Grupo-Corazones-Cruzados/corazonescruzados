import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/member/paquete-asignaciones/[id]/avances - Add avance with hours and images
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

    // Verify ownership
    const asignacionResult = await query(
      `SELECT pa.* FROM paquete_asignaciones pa
       WHERE pa.id = $1 AND pa.id_miembro = $2
       AND pa.estado IN ('aprobado', 'en_progreso')`,
      [asigId, idMiembro]
    );

    if (asignacionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Asignacion no encontrada o no esta activa" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { contenido, horas_reportadas, imagenes } = body;

    if (!contenido || !contenido.trim()) {
      return NextResponse.json(
        { error: "El contenido es requerido" },
        { status: 400 }
      );
    }

    // Insert avance
    const avanceResult = await query(
      `INSERT INTO paquete_avances (id_asignacion, autor_tipo, id_autor, contenido, horas_reportadas, imagenes)
       VALUES ($1, 'miembro', $2, $3, $4, $5)
       RETURNING *`,
      [
        asigId,
        tokenData.userId,
        contenido.trim(),
        horas_reportadas || 0,
        JSON.stringify(imagenes || []),
      ]
    );

    // If first avance with hours, update asignacion to en_progreso
    const asignacion = asignacionResult.rows[0];
    if (asignacion.estado === "aprobado") {
      await query(
        `UPDATE paquete_asignaciones SET estado = 'en_progreso' WHERE id = $1`,
        [asigId]
      );

      // Also update solicitud
      await query(
        `UPDATE paquete_solicitudes SET estado = 'en_progreso'
         WHERE id = $1 AND estado IN ('pendiente', 'parcial')`,
        [asignacion.id_solicitud]
      );
    }

    return NextResponse.json({ avance: avanceResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error adding avance:", error);
    return NextResponse.json(
      { error: "Error al agregar avance" },
      { status: 500 }
    );
  }
}
