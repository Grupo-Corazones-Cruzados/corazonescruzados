import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/client/paquete-solicitudes/[id]/asignaciones/[asignacionId]/avances
// Client adds a comment to an assignment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; asignacionId: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { asignacionId } = await params;
    const asigId = parseInt(asignacionId);

    if (isNaN(asigId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const body = await request.json();
    const { contenido } = body;

    if (!contenido || !contenido.trim()) {
      return NextResponse.json(
        { error: "El contenido es requerido" },
        { status: 400 }
      );
    }

    // Verify client owns this asignacion's solicitud
    const ownerCheck = await query(
      `SELECT pa.id FROM paquete_asignaciones pa
       JOIN paquete_solicitudes ps ON pa.id_solicitud = ps.id
       WHERE pa.id = $1 AND ps.id_cliente = $2`,
      [asigId, tokenData.userId]
    );

    if (ownerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Asignacion no encontrada" },
        { status: 404 }
      );
    }

    // Insert avance as client comment (no horas_reportadas)
    const avanceResult = await query(
      `INSERT INTO paquete_avances (id_asignacion, autor_tipo, id_autor, contenido, horas_reportadas)
       VALUES ($1, 'cliente', $2, $3, 0)
       RETURNING *`,
      [asigId, tokenData.userId, contenido.trim()]
    );

    return NextResponse.json({ avance: avanceResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error adding client avance:", error);
    return NextResponse.json(
      { error: "Error al agregar comentario" },
      { status: 500 }
    );
  }
}
