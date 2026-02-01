import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import {
  sendPackageApprovedToClient,
  sendPackageRejectedToClient,
  sendPackageOnHoldToClient,
} from "@/lib/email";

// GET /api/member/packages/[id] - Get package detail for member
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
          'id', up.id,
          'nombre', COALESCE(up.nombre || ' ' || COALESCE(up.apellido, ''), up.email),
          'correo_electronico', up.email
        ) as cliente
      FROM package_purchases pp
      JOIN paquetes p ON pp.id_paquete = p.id
      JOIN user_profiles up ON pp.id_cliente = up.id
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
       WHERE id_purchase = $1
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

// PATCH /api/member/packages/[id] - Member responds to package (approve/reject/on_hold)
export async function PATCH(
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
    const { estado, motivo } = body;

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    if (!estado || !["aprobado", "rechazado", "en_espera"].includes(estado)) {
      return NextResponse.json(
        { error: "Estado invalido. Debe ser: aprobado, rechazado o en_espera" },
        { status: 400 }
      );
    }

    // Verify ownership
    const purchaseResult = await query(
      `SELECT pp.*,
              COALESCE(up.nombre || ' ' || COALESCE(up.apellido, ''), up.email) as cliente_nombre,
              up.email as cliente_email,
              p.nombre as paquete_nombre, m.nombre as miembro_nombre
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

    // Can only respond if pending or on_hold
    if (purchase.estado !== "pendiente" && purchase.estado !== "en_espera") {
      return NextResponse.json(
        { error: "Solo puedes responder a paquetes pendientes o en espera" },
        { status: 400 }
      );
    }

    // Update purchase
    let updateSql = `UPDATE package_purchases SET estado = $1, fecha_respuesta = NOW()`;
    const updateParams: any[] = [estado];
    let paramIndex = 2;

    if (estado === "rechazado") {
      updateSql += `, motivo_rechazo = $${paramIndex}`;
      updateParams.push(motivo || null);
      paramIndex++;
    } else if (estado === "en_espera") {
      updateSql += `, motivo_espera = $${paramIndex}`;
      updateParams.push(motivo || null);
      paramIndex++;
    }

    updateSql += ` WHERE id = $${paramIndex}`;
    updateParams.push(purchaseId);

    await query(updateSql, updateParams);

    // Send email to client based on response
    if (estado === "aprobado") {
      await sendPackageApprovedToClient(
        purchase.cliente_email,
        purchase.cliente_nombre,
        {
          id: purchase.id,
          nombre: purchase.paquete_nombre,
        },
        purchase.miembro_nombre
      );
    } else if (estado === "rechazado") {
      await sendPackageRejectedToClient(
        purchase.cliente_email,
        purchase.cliente_nombre,
        {
          id: purchase.id,
          nombre: purchase.paquete_nombre,
        },
        purchase.miembro_nombre,
        motivo
      );
    } else if (estado === "en_espera") {
      await sendPackageOnHoldToClient(
        purchase.cliente_email,
        purchase.cliente_nombre,
        {
          id: purchase.id,
          nombre: purchase.paquete_nombre,
        },
        purchase.miembro_nombre,
        motivo
      );
    }

    return NextResponse.json({ success: true, estado });
  } catch (error) {
    console.error("Error updating package:", error);
    return NextResponse.json(
      { error: "Error al actualizar el paquete" },
      { status: 500 }
    );
  }
}
