import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/projects - Get all projects for admin
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user is admin
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const estado = searchParams.get("estado") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build WHERE clauses
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(p.titulo ILIKE $${paramIndex} OR c.nombre ILIKE $${paramIndex} OR mp.nombre ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (estado) {
      conditions.push(`p.estado = $${paramIndex}`);
      values.push(estado);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM projects p
       LEFT JOIN clientes c ON p.id_cliente = c.id
       LEFT JOIN miembros mp ON p.id_miembro_propietario = mp.id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total);

    // Get projects with owner info
    const projectsResult = await query(
      `SELECT
        p.id,
        p.titulo,
        p.estado,
        p.tipo_proyecto,
        p.visibilidad,
        p.presupuesto_min,
        p.presupuesto_max,
        p.created_at,
        p.updated_at,
        CASE
          WHEN p.tipo_proyecto = 'cliente' THEN c.nombre
          ELSE mp.nombre
        END as propietario_nombre,
        CASE
          WHEN p.tipo_proyecto = 'cliente' THEN 'cliente'
          ELSE 'miembro'
        END as propietario_tipo,
        (SELECT COUNT(*) FROM project_bids pb WHERE pb.id_project = p.id) as total_postulaciones,
        (SELECT COUNT(*) FROM project_bids pb WHERE pb.id_project = p.id AND pb.estado = 'aceptada') as miembros_aceptados,
        (SELECT COUNT(*) FROM project_requirements pr WHERE pr.id_project = p.id) as total_requerimientos,
        (SELECT COUNT(*) FROM project_requirements pr WHERE pr.id_project = p.id AND pr.completado = true) as requerimientos_completados
       FROM projects p
       LEFT JOIN clientes c ON p.id_cliente = c.id
       LEFT JOIN miembros mp ON p.id_miembro_propietario = mp.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return NextResponse.json({
      projects: projectsResult.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching admin projects:", error);
    return NextResponse.json({ error: "Error al cargar proyectos" }, { status: 500 });
  }
}

// DELETE /api/admin/projects - Delete a project (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user is admin
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json({ error: "ID de proyecto requerido" }, { status: 400 });
    }

    // Get project info before deletion
    const projectResult = await query(
      "SELECT id, titulo FROM projects WHERE id = $1",
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Delete the project (cascades will handle related records)
    await query("DELETE FROM projects WHERE id = $1", [projectId]);

    return NextResponse.json({
      success: true,
      message: `Proyecto "${project.titulo}" eliminado correctamente`,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Error al eliminar proyecto" }, { status: 500 });
  }
}
