import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/finish-work - Mark member's work as finished
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

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

    if (userRol !== "miembro" && userRol !== "admin") {
      return NextResponse.json({ error: "Solo miembros pueden marcar trabajo finalizado" }, { status: 403 });
    }

    if (!userMiembroId) {
      return NextResponse.json({ error: "No se encontró el perfil de miembro" }, { status: 400 });
    }

    // Verify project is en_progreso
    const projectResult = await query(
      "SELECT estado FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (projectResult.rows[0].estado !== "en_progreso") {
      return NextResponse.json({ error: "El proyecto no está en progreso" }, { status: 400 });
    }

    // Verify member has an accepted bid
    const bidResult = await query(
      "SELECT id, trabajo_finalizado FROM project_bids WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada'",
      [projectId, userMiembroId]
    );
    if (bidResult.rows.length === 0) {
      return NextResponse.json({ error: "No tienes una postulación aceptada en este proyecto" }, { status: 403 });
    }

    if (bidResult.rows[0].trabajo_finalizado) {
      return NextResponse.json({ error: "Ya has marcado tu trabajo como finalizado" }, { status: 400 });
    }

    // Mark work as finished
    await query(
      "UPDATE project_bids SET trabajo_finalizado = true, fecha_trabajo_finalizado = NOW() WHERE id = $1",
      [bidResult.rows[0].id]
    );

    // Auto-check: did all accepted members finish?
    const countResult = await query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE trabajo_finalizado = true) as finalizados
      FROM project_bids
      WHERE id_project = $1 AND estado = 'aceptada'`,
      [projectId]
    );

    const total = parseInt(countResult.rows[0].total);
    const finalizados = parseInt(countResult.rows[0].finalizados);
    let proyecto_completado = false;

    if (total > 0 && finalizados >= total) {
      // All members finished - auto-complete project
      await query(
        "UPDATE projects SET estado = 'completado', updated_at = NOW() WHERE id = $1",
        [projectId]
      );
      proyecto_completado = true;
    }

    return NextResponse.json({
      success: true,
      proyecto_completado,
      message: proyecto_completado
        ? "Proyecto completado automáticamente. Todos los miembros finalizaron su trabajo."
        : "Trabajo marcado como finalizado.",
    });
  } catch (error) {
    console.error("Error finishing work:", error);
    return NextResponse.json({ error: "Error al marcar trabajo como finalizado" }, { status: 500 });
  }
}
