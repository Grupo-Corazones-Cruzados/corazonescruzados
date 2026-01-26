import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/projects/[id] - Get a single project with bids and requirements
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get project with relations
    const projectResult = await query(
      `SELECT
        p.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto) as miembro_asignado
      FROM projects p
      LEFT JOIN clientes c ON p.id_cliente = c.id
      LEFT JOIN miembros m ON p.id_miembro_asignado = m.id
      WHERE p.id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Get bids
    const bidsResult = await query(
      `SELECT pb.*, json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto, 'puesto', m.puesto) as miembro
       FROM project_bids pb
       LEFT JOIN miembros m ON pb.id_miembro = m.id
       WHERE pb.id_project = $1
       ORDER BY pb.created_at DESC`,
      [projectId]
    );

    // Get requirements
    const requirementsResult = await query(
      `SELECT * FROM project_requirements
       WHERE id_project = $1
       ORDER BY created_at ASC`,
      [projectId]
    );

    return NextResponse.json({
      project: projectResult.rows[0],
      bids: bidsResult.rows,
      requirements: requirementsResult.rows,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Error al cargar el proyecto" }, { status: 500 });
  }
}

// PATCH /api/projects/[id] - Update a project
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      "titulo",
      "descripcion",
      "presupuesto_min",
      "presupuesto_max",
      "fecha_limite",
      "estado",
      "id_miembro_asignado",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(projectId);
    const sql = `UPDATE projects SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ project: result.rows[0] });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Error al actualizar el proyecto" }, { status: 500 });
  }
}

// DELETE /api/projects/[id] - Delete a project
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    await query("DELETE FROM projects WHERE id = $1", [projectId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Error al eliminar el proyecto" }, { status: 500 });
  }
}
