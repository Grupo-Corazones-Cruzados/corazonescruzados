import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { sendRequirementCompletedToExternalClient } from "@/lib/email";

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

    // Verify project state allows adding requirements
    const projectCheck = await query(
      "SELECT estado, id_cliente, id_miembro_propietario, tipo_proyecto FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectCheck.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    // Allow adding requirements in more states including new intermediate states
    const allowedAddStates = ["borrador", "publicado", "planificado", "iniciado", "en_progreso", "en_implementacion", "en_pruebas"];
    if (!allowedAddStates.includes(projectCheck.rows[0].estado)) {
      return NextResponse.json({ error: "No se pueden agregar requerimientos en este estado" }, { status: 400 });
    }

    // Determine creado_por based on user role
    const userResult = await query(
      "SELECT rol, id_miembro, email FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const rol = userResult.rows[0]?.rol || "cliente";
    const creado_por = rol === "miembro" || rol === "admin" ? "miembro" : "cliente";

    let creado_por_miembro_id: number | null = null;
    let creado_por_cliente_id: number | null = null;

    if (rol === "miembro" || rol === "admin") {
      const miembroId = userResult.rows[0].id_miembro;

      // Check if member is the owner of this project
      const isMemberOwner = projectCheck.rows[0].id_miembro_propietario === miembroId;

      if (!isMemberOwner) {
        // If not owner, verify member has an accepted bid for this project
        const bidCheck = await query(
          "SELECT id FROM project_bids WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada'",
          [projectId, miembroId]
        );
        if (bidCheck.rows.length === 0) {
          return NextResponse.json({ error: "Solo miembros aceptados o el propietario pueden agregar requerimientos" }, { status: 403 });
        }
      }
      creado_por_miembro_id = miembroId;
    } else {
      // Verify client owns the project
      const clienteResult = await query(
        "SELECT id FROM clientes WHERE correo_electronico = $1",
        [userResult.rows[0].email]
      );
      if (clienteResult.rows.length === 0 || clienteResult.rows[0].id !== projectCheck.rows[0].id_cliente) {
        return NextResponse.json({ error: "Solo el dueño del proyecto puede agregar requerimientos" }, { status: 403 });
      }
      creado_por_cliente_id = clienteResult.rows[0].id;
    }

    const result = await query(
      `INSERT INTO project_requirements (id_project, titulo, descripcion, costo, completado, creado_por, es_adicional, creado_por_miembro_id, creado_por_cliente_id)
       VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8)
       RETURNING *`,
      [projectId, titulo, descripcion || null, costo || null, creado_por, es_adicional === true, creado_por_miembro_id, creado_por_cliente_id]
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

    const { id } = await context.params;
    const projectId = parseInt(id);

    // Get user role and the requirement's creado_por
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const rol = userResult.rows[0]?.rol || "cliente";

    const reqResult = await query(
      "SELECT creado_por, id_project FROM project_requirements WHERE id = $1",
      [requirementId]
    );
    if (reqResult.rows.length === 0) {
      return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });
    }

    // Permission check: client can only edit their own requirements
    if (rol === "cliente" && reqResult.rows[0].creado_por !== "cliente") {
      return NextResponse.json({ error: "No tienes permiso para editar este requerimiento" }, { status: 403 });
    }

    // If toggling completado, project must be in an active working state
    if (updates.completado !== undefined) {
      const projectCheck = await query(
        "SELECT estado, cliente_externo_email, cliente_externo_nombre, share_token, titulo FROM projects WHERE id = $1",
        [projectId]
      );
      const activeStates = ["iniciado", "en_progreso", "en_implementacion", "en_pruebas"];
      if (!activeStates.includes(projectCheck.rows[0]?.estado)) {
        return NextResponse.json({ error: "Solo se puede marcar completado cuando el proyecto está en un estado activo" }, { status: 400 });
      }
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

    // Send email to external client if requirement was completed
    if (updates.completado === true) {
      const projectCheck = await query(
        "SELECT id, titulo, cliente_externo_email, cliente_externo_nombre, share_token FROM projects WHERE id = $1",
        [projectId]
      );

      if (projectCheck.rows[0]?.cliente_externo_email && projectCheck.rows[0]?.cliente_externo_nombre) {
        const project = projectCheck.rows[0];

        // Get member name who completed
        let completadoPorNombre = "Un miembro del equipo";
        const userMiembroId = userResult.rows[0]?.id_miembro;
        if (userMiembroId) {
          const memberResult = await query("SELECT nombre FROM miembros WHERE id = $1", [userMiembroId]);
          if (memberResult.rows.length > 0) {
            completadoPorNombre = memberResult.rows[0].nombre;
          }
        }

        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const shareUrl = project.share_token
          ? `${APP_URL}/p/${project.share_token}`
          : `${APP_URL}`;

        // Send email asynchronously (don't wait)
        sendRequirementCompletedToExternalClient(
          project.cliente_externo_email,
          project.cliente_externo_nombre,
          { id: project.id, titulo: project.titulo },
          { titulo: result.rows[0].titulo, costo: result.rows[0].costo },
          completadoPorNombre,
          shareUrl
        ).catch(err => console.error("Error sending requirement completed email:", err));
      }
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
