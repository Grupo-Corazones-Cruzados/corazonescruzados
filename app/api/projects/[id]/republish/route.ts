import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/republish - Republish a project in progress
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { titulo, descripcion } = body;

    if (!titulo) {
      return NextResponse.json({ error: "Título es requerido" }, { status: 400 });
    }

    // Verify user is the client owner
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const userRol = userResult.rows[0]?.rol;
    if (userRol !== "cliente") {
      return NextResponse.json({ error: "Solo el cliente puede republicar el proyecto" }, { status: 403 });
    }

    // Verify project exists and is en_progreso
    const projectResult = await query(
      "SELECT estado, id_cliente FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (projectResult.rows[0].estado !== "en_progreso") {
      return NextResponse.json({ error: "Solo se puede republicar un proyecto en progreso" }, { status: 400 });
    }

    // Update title, description, and set republicado = true
    await query(
      `UPDATE projects SET titulo = $1, descripcion = $2, republicado = true, updated_at = NOW() WHERE id = $3`,
      [titulo, descripcion || null, projectId]
    );

    return NextResponse.json({ success: true, message: "Proyecto republicado exitosamente" });
  } catch (error) {
    console.error("Error republishing project:", error);
    return NextResponse.json({ error: "Error al republicar el proyecto" }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/republish - Close convocatoria
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();

    if (body.action !== "cerrar_convocatoria") {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

    // Verify user is the client owner
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    const userRol = userResult.rows[0]?.rol;
    if (userRol !== "cliente") {
      return NextResponse.json({ error: "Solo el cliente puede cerrar la convocatoria" }, { status: 403 });
    }

    // Verify project exists and is republicado
    const projectResult = await query(
      "SELECT estado, republicado FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    if (projectResult.rows[0].estado !== "en_progreso" || !projectResult.rows[0].republicado) {
      return NextResponse.json({ error: "El proyecto no tiene una convocatoria abierta" }, { status: 400 });
    }

    await query(
      `UPDATE projects SET republicado = false, updated_at = NOW() WHERE id = $1`,
      [projectId]
    );

    return NextResponse.json({ success: true, message: "Convocatoria cerrada" });
  } catch (error) {
    console.error("Error closing convocatoria:", error);
    return NextResponse.json({ error: "Error al cerrar la convocatoria" }, { status: 500 });
  }
}
