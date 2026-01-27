import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

const MEMBER_CLOSE_STATES = [
  "completado_parcial",
  "no_completado",
  "cancelado_sin_acuerdo",
  "cancelado_sin_presupuesto",
  "no_pagado",
];

const CLIENT_CLOSE_STATES = ["no_completado_por_miembro"];

const STATES_REQUIRING_JUSTIFICATION = [
  "no_completado",
  "cancelado_sin_acuerdo",
  "cancelado_sin_presupuesto",
  "no_pagado",
  "no_completado_por_miembro",
];

// POST /api/projects/[id]/complete - Close/complete a project
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { estado, justificacion } = body;

    if (!estado) {
      return NextResponse.json({ error: "Estado es requerido" }, { status: 400 });
    }

    // Get user info
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const userRol = userResult.rows[0].rol;
    const userMiembroId = userResult.rows[0].id_miembro;

    // Validate state based on role
    if (userRol === "miembro" || userRol === "admin") {
      if (!MEMBER_CLOSE_STATES.includes(estado)) {
        return NextResponse.json({ error: "Estado de cierre inválido para miembro" }, { status: 400 });
      }
    } else if (userRol === "cliente") {
      if (!CLIENT_CLOSE_STATES.includes(estado)) {
        return NextResponse.json({ error: "Estado de cierre inválido para cliente" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Rol no autorizado" }, { status: 403 });
    }

    // Check if justification is required
    if (STATES_REQUIRING_JUSTIFICATION.includes(estado) && !justificacion) {
      return NextResponse.json({ error: "Justificación es requerida para este estado" }, { status: 400 });
    }

    // Verify project is in en_progreso
    const projectResult = await query(
      "SELECT estado, id_miembro_asignado, id_cliente FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (projectResult.rows[0].estado !== "en_progreso") {
      return NextResponse.json({ error: "El proyecto no está en progreso" }, { status: 400 });
    }

    // Verify the user is involved in the project
    if (userRol === "miembro" && projectResult.rows[0].id_miembro_asignado !== userMiembroId) {
      return NextResponse.json({ error: "No eres el miembro asignado a este proyecto" }, { status: 403 });
    }

    const cerrado_por = userRol === "cliente" ? "cliente" : "miembro";

    // Special logic for "no_pagado" - block client and their IP
    if (estado === "no_pagado") {
      await transaction(async (client) => {
        // Update project
        await client.query(
          `UPDATE projects SET estado = $1, justificacion_cierre = $2, cerrado_por = $3, updated_at = NOW() WHERE id = $4`,
          [estado, justificacion, cerrado_por, projectId]
        );

        // Find user_profile of the client (via clientes table email match)
        const clienteId = projectResult.rows[0].id_cliente;
        const clienteResult = await client.query(
          "SELECT correo_electronico FROM clientes WHERE id = $1",
          [clienteId]
        );

        if (clienteResult.rows.length > 0) {
          const clienteEmail = clienteResult.rows[0].correo_electronico;
          const userProfileResult = await client.query(
            "SELECT id, last_ip FROM user_profiles WHERE email = $1",
            [clienteEmail]
          );

          if (userProfileResult.rows.length > 0) {
            const clientUserId = userProfileResult.rows[0].id;
            const clientIp = userProfileResult.rows[0].last_ip;

            // Block user
            await client.query(
              `UPDATE user_profiles SET bloqueado = true, bloqueado_en = NOW(), motivo_bloqueo = $1 WHERE id = $2`,
              [`Bloqueado por no pagar proyecto #${projectId}: ${justificacion}`, clientUserId]
            );

            // Block IP if available
            if (clientIp) {
              await client.query(
                `INSERT INTO blocked_ips (ip_address, user_id, motivo) VALUES ($1, $2, $3)`,
                [clientIp, clientUserId, `No pago en proyecto #${projectId}`]
              );
            }
          }
        }
      });

      return NextResponse.json({ success: true, message: "Proyecto cerrado. Cliente bloqueado por falta de pago." });
    }

    // Special logic for "no_completado_por_miembro" - restrict member
    if (estado === "no_completado_por_miembro") {
      await transaction(async (client) => {
        // Update project
        await client.query(
          `UPDATE projects SET estado = $1, justificacion_cierre = $2, cerrado_por = $3, updated_at = NOW() WHERE id = $4`,
          [estado, justificacion, cerrado_por, projectId]
        );

        // Restrict member
        const miembroAsignado = projectResult.rows[0].id_miembro_asignado;
        if (miembroAsignado) {
          await client.query(
            `UPDATE miembros SET restringido_proyectos = true, motivo_restriccion = $1, restringido_en = NOW() WHERE id = $2`,
            [`Reportado en proyecto #${projectId}: ${justificacion}`, miembroAsignado]
          );
        }
      });

      return NextResponse.json({ success: true, message: "Proyecto cerrado. Miembro restringido." });
    }

    // Standard close
    await query(
      `UPDATE projects SET estado = $1, justificacion_cierre = $2, cerrado_por = $3, updated_at = NOW() WHERE id = $4`,
      [estado, justificacion || null, cerrado_por, projectId]
    );

    return NextResponse.json({ success: true, message: "Proyecto cerrado exitosamente." });
  } catch (error) {
    console.error("Error completing project:", error);
    return NextResponse.json({ error: "Error al cerrar el proyecto" }, { status: 500 });
  }
}
