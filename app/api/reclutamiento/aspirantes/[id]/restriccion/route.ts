import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess } from "@/lib/reclutamiento";

// POST /api/reclutamiento/aspirantes/[id]/restriccion - Apply/lift restriction
export async function POST(
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
    const { accion } = body; // 'aplicar' or 'levantar'

    // Verify postulación exists
    const postResult = await query(
      `SELECT id FROM postulaciones WHERE id = $1`,
      [id]
    );
    if (postResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Postulación no encontrada" },
        { status: 404 }
      );
    }

    if (accion === "levantar") {
      const { id_restriccion } = body;
      if (!id_restriccion) {
        return NextResponse.json(
          { error: "ID de restricción requerido" },
          { status: 400 }
        );
      }

      // Only admin can lift permanent restrictions
      const restrictionCheck = await query(
        `SELECT tipo FROM restricciones_reclutamiento WHERE id = $1 AND id_postulacion = $2`,
        [id_restriccion, id]
      );
      if (restrictionCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Restricción no encontrada" },
          { status: 404 }
        );
      }
      if (restrictionCheck.rows[0].tipo === "permanente" && access.rol !== "admin") {
        return NextResponse.json(
          { error: "Solo un admin puede levantar restricciones permanentes" },
          { status: 403 }
        );
      }

      const result = await query(
        `UPDATE restricciones_reclutamiento
         SET levantado = TRUE, levantado_por = $1, levantado_en = NOW()
         WHERE id = $2
         RETURNING *`,
        [tokenData.userId, id_restriccion]
      );

      return NextResponse.json({ restriccion: result.rows[0] });
    }

    // Apply restriction
    const { tipo, motivo, dias } = body;

    if (!tipo || !["permanente", "temporal"].includes(tipo)) {
      return NextResponse.json(
        { error: "Tipo de restricción inválido" },
        { status: 400 }
      );
    }

    // Only admin can apply permanent restrictions
    if (tipo === "permanente" && access.rol !== "admin") {
      return NextResponse.json(
        { error: "Solo un admin puede aplicar restricciones permanentes" },
        { status: 403 }
      );
    }

    let fechaExpiracion = null;
    if (tipo === "temporal") {
      if (!dias || dias < 1) {
        return NextResponse.json(
          { error: "Días requeridos para restricción temporal" },
          { status: 400 }
        );
      }
      fechaExpiracion = new Date();
      fechaExpiracion.setDate(fechaExpiracion.getDate() + dias);
    }

    const result = await query(
      `INSERT INTO restricciones_reclutamiento (id_postulacion, restringido_por, tipo, motivo, dias, fecha_expiracion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, tokenData.userId, tipo, motivo || null, dias || null, fechaExpiracion]
    );

    return NextResponse.json({ restriccion: result.rows[0] });
  } catch (error) {
    console.error("Error managing restricción:", error);
    return NextResponse.json(
      { error: "Error al gestionar restricción" },
      { status: 500 }
    );
  }
}
