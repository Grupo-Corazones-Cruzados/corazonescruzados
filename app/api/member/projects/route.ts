import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/member/projects - Get projects where the member has bid or has an accepted bid
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get user profile + member id
    const userResult = await query(
      "SELECT id, rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "miembro") {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    if (!miembroId) {
      return NextResponse.json({ error: "No tienes un registro de miembro vinculado" }, { status: 403 });
    }

    // Get projects where member has submitted a bid (any status)
    const result = await query(
      `SELECT DISTINCT
        p.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        pb_me.id as mi_bid_id,
        pb_me.estado as mi_bid_estado,
        pb_me.precio_ofertado as mi_precio_ofertado,
        pb_me.monto_acordado as mi_monto_acordado,
        pb_me.confirmado_por_miembro as mi_confirmado,
        (SELECT COUNT(*) FROM project_bids WHERE id_project = p.id) as bids_count,
        (SELECT COUNT(*) FROM project_bids WHERE id_project = p.id AND estado = 'aceptada') as accepted_count
      FROM projects p
      LEFT JOIN clientes c ON p.id_cliente = c.id
      INNER JOIN project_bids pb_me ON pb_me.id_project = p.id AND pb_me.id_miembro = $1
      ORDER BY p.updated_at DESC`,
      [miembroId]
    );

    // Compute stats
    const projects = result.rows;
    const stats = {
      total: projects.length,
      postulados: projects.filter((p: any) => p.mi_bid_estado === "pendiente").length,
      asignados: projects.filter((p: any) => p.mi_bid_estado === "aceptada" && ["publicado", "planificado", "en_progreso"].includes(p.estado)).length,
      completados: projects.filter((p: any) => p.mi_bid_estado === "aceptada" && ["completado", "completado_parcial"].includes(p.estado)).length,
      rechazados: projects.filter((p: any) => p.mi_bid_estado === "rechazada").length,
    };

    return NextResponse.json({ projects, stats });
  } catch (error) {
    console.error("Error fetching member projects:", error);
    return NextResponse.json({ error: "Error al cargar los proyectos" }, { status: 500 });
  }
}
