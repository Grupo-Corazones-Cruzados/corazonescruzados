import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/requirements - Get requirements for a project
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    const result = await query(
      `SELECT * FROM project_requirements
       WHERE id_project = $1
       ORDER BY created_at ASC`,
      [projectId]
    );

    return NextResponse.json({ requirements: result.rows });
  } catch (error) {
    console.error("Error fetching requirements:", error);
    return NextResponse.json({ error: "Error al cargar los requerimientos" }, { status: 500 });
  }
}

// POST /api/projects/[id]/requirements - Add a requirement
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { titulo, descripcion, costo, es_adicional } = body;

    if (!titulo) {
      return NextResponse.json({ error: "Título es requerido" }, { status: 400 });
    }

    // Determine creado_por based on user role
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const rol = userResult.rows[0]?.rol || "cliente";
    const creado_por = rol === "miembro" || rol === "admin" ? "miembro" : "cliente";

    const result = await query(
      `INSERT INTO project_requirements (id_project, titulo, descripcion, costo, completado, creado_por, es_adicional)
       VALUES ($1, $2, $3, $4, false, $5, $6)
       RETURNING *`,
      [projectId, titulo, descripcion || null, costo || null, creado_por, es_adicional === true]
    );

    return NextResponse.json({ requirement: result.rows[0] });
  } catch (error) {
    console.error("Error creating requirement:", error);
    return NextResponse.json({ error: "Error al crear el requerimiento" }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/requirements - Update a requirement
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { requirementId, ...updates } = body;

    if (!requirementId) {
      return NextResponse.json({ error: "ID del requerimiento es requerido" }, { status: 400 });
    }

    // Get user role and the requirement's creado_por
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const rol = userResult.rows[0]?.rol || "cliente";

    const reqResult = await query(
      "SELECT creado_por FROM project_requirements WHERE id = $1",
      [requirementId]
    );
    if (reqResult.rows.length === 0) {
      return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });
    }

    // Permission check: client can only edit their own requirements
    if (rol === "cliente" && reqResult.rows[0].creado_por !== "cliente") {
      return NextResponse.json({ error: "No tienes permiso para editar este requerimiento" }, { status: 403 });
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ["titulo", "descripcion", "costo", "completado", "es_adicional"];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    // If completing, set completion date and completado_por
    if (updates.completado === true) {
      updateFields.push(`fecha_completado = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex++;

      // Set completado_por to the member who completed it
      const userMiembroId = userResult.rows[0]?.id_miembro;
      if (userMiembroId) {
        updateFields.push(`completado_por = $${paramIndex}`);
        values.push(userMiembroId);
        paramIndex++;
      }
    } else if (updates.completado === false) {
      updateFields.push(`fecha_completado = NULL`);
      updateFields.push(`completado_por = NULL`);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(requirementId);
    const sql = `UPDATE project_requirements SET ${updateFields.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ requirement: result.rows[0] });
  } catch (error) {
    console.error("Error updating requirement:", error);
    return NextResponse.json({ error: "Error al actualizar el requerimiento" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/requirements - Delete a requirement
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Only members and admins can delete requirements
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const rol = userResult.rows[0]?.rol || "cliente";

    if (rol === "cliente") {
      return NextResponse.json({ error: "No tienes permiso para eliminar requerimientos" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requirementId = searchParams.get("requirementId");

    if (!requirementId) {
      return NextResponse.json({ error: "ID del requerimiento es requerido" }, { status: 400 });
    }

    await query("DELETE FROM project_requirements WHERE id = $1", [parseInt(requirementId)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting requirement:", error);
    return NextResponse.json({ error: "Error al eliminar el requerimiento" }, { status: 500 });
  }
}
