import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { sendPackageCompletedReport } from "@/lib/email";

// POST /api/member/packages/[id]/close - Close a package with report
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
    const { reporte } = body;

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Get purchase with all related data
    const purchaseResult = await query(
      `SELECT pp.*,
              COALESCE(up.nombre || ' ' || COALESCE(up.apellido, ''), up.email) as cliente_nombre,
              up.email as cliente_email,
              p.nombre as paquete_nombre, p.descripcion as paquete_descripcion,
              m.nombre as miembro_nombre
       FROM package_purchases pp
       JOIN user_profiles up ON pp.id_cliente = up.id
       JOIN paquetes p ON pp.id_paquete = p.id
       JOIN miembros m ON pp.id_miembro = m.id
       WHERE pp.id = $1 AND pp.id_miembro = $2`,
      [purchaseId, idMiembro]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    const purchase = purchaseResult.rows[0];

    // Can only close if in progress or approved
    if (purchase.estado !== "en_progreso" && purchase.estado !== "aprobado") {
      return NextResponse.json(
        { error: "Solo puedes cerrar paquetes en progreso o aprobados" },
        { status: 400 }
      );
    }

    // Get completed sessions for the report
    const sessionsResult = await query(
      `SELECT * FROM package_sessions
       WHERE id_purchase = $1 AND estado = 'completada'
       ORDER BY fecha ASC`,
      [purchaseId]
    );

    // Update purchase to completed
    await query(
      `UPDATE package_purchases
       SET estado = 'completado', fecha_cierre = NOW(), reporte_cierre = $1
       WHERE id = $2`,
      [reporte || null, purchaseId]
    );

    // Send email with completion report
    await sendPackageCompletedReport(
      purchase.cliente_email,
      purchase.cliente_nombre,
      {
        id: purchase.id,
        nombre: purchase.paquete_nombre,
        descripcion: purchase.paquete_descripcion,
        horas_totales: purchase.horas_totales,
        horas_consumidas: purchase.horas_consumidas,
      },
      purchase.miembro_nombre,
      sessionsResult.rows,
      reporte
    );

    return NextResponse.json({ success: true, estado: "completado" });
  } catch (error) {
    console.error("Error closing package:", error);
    return NextResponse.json(
      { error: "Error al cerrar el paquete" },
      { status: 500 }
    );
  }
}
