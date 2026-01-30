import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// Helper to verify member ownership
async function verifyOwnership(projectId: number, miembroId: number) {
  const result = await query(
    "SELECT id, id_miembro_propietario, tipo_proyecto FROM projects WHERE id = $1",
    [projectId]
  );

  if (result.rows.length === 0) {
    return { error: "Proyecto no encontrado", status: 404 };
  }

  const project = result.rows[0];

  if (project.tipo_proyecto !== "miembro") {
    return { error: "Este no es un proyecto de miembro", status: 403 };
  }

  if (project.id_miembro_propietario !== miembroId) {
    return { error: "No eres el propietario de este proyecto", status: 403 };
  }

  return { project };
}

// GET /api/member/projects/[id] - Get details of a member-owned project
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get user profile + member id
    const userResult = await query(
      "SELECT id, rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || (userResult.rows[0].rol !== "miembro" && userResult.rows[0].rol !== "admin")) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    const isAdmin = userResult.rows[0].rol === "admin";

    // Get project with all related data
    const projectResult = await query(
      `SELECT
        p.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        json_build_object('id', mp.id, 'nombre', mp.nombre, 'foto', mp.foto, 'puesto', mp.puesto) as miembro_propietario
      FROM projects p
      LEFT JOIN clientes c ON p.id_cliente = c.id
      LEFT JOIN miembros mp ON p.id_miembro_propietario = mp.id
      WHERE p.id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Access check
    const isOwner = project.id_miembro_propietario === miembroId;
    const isPublic = project.visibilidad === "publico";

    if (!isAdmin && !isOwner && !isPublic) {
      return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
    }

    return NextResponse.json({ project, es_propietario: isOwner });
  } catch (error) {
    console.error("Error fetching member project:", error);
    return NextResponse.json({ error: "Error al cargar el proyecto" }, { status: 500 });
  }
}

// PATCH /api/member/projects/[id] - Update a member-owned project
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get user profile + member id
    const userResult = await query(
      "SELECT id, rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || (userResult.rows[0].rol !== "miembro" && userResult.rows[0].rol !== "admin")) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    const isAdmin = userResult.rows[0].rol === "admin";

    // Verify ownership (admin can also update)
    const ownerCheck = await verifyOwnership(projectId, miembroId);
    if (!isAdmin && ownerCheck.error) {
      return NextResponse.json({ error: ownerCheck.error }, { status: ownerCheck.status });
    }

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
      "visibilidad",
      "id_cliente",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Validate visibilidad
        if (field === "visibilidad" && !["privado", "publico"].includes(body[field])) {
          return NextResponse.json({ error: "Visibilidad inválida" }, { status: 400 });
        }

        // Validate id_cliente if provided
        if (field === "id_cliente" && body[field]) {
          const clientCheck = await query("SELECT id FROM clientes WHERE id = $1", [body[field]]);
          if (clientCheck.rows.length === 0) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
          }
        }

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
    console.error("Error updating member project:", error);
    return NextResponse.json({ error: "Error al actualizar el proyecto" }, { status: 500 });
  }
}

// DELETE /api/member/projects/[id] - Delete a member-owned project
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get user profile + member id
    const userResult = await query(
      "SELECT id, rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || (userResult.rows[0].rol !== "miembro" && userResult.rows[0].rol !== "admin")) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    const isAdmin = userResult.rows[0].rol === "admin";

    // Verify ownership (admin can also delete)
    const ownerCheck = await verifyOwnership(projectId, miembroId);
    if (!isAdmin && ownerCheck.error) {
      return NextResponse.json({ error: ownerCheck.error }, { status: ownerCheck.status });
    }

    // Delete the project (cascades will handle related records)
    await query("DELETE FROM projects WHERE id = $1", [projectId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting member project:", error);
    return NextResponse.json({ error: "Error al eliminar el proyecto" }, { status: 500 });
  }
}
