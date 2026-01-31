import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// POST - Publicar proyecto privado (abrirlo a postulaciones)
export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;

    // Obtener proyecto actual
    const projectResult = await query(
      `SELECT * FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar permisos (solo el propietario puede publicar)
    const isClientOwner = tokenData.role === "cliente" && project.id_cliente === tokenData.id;
    const isMemberOwner = tokenData.role === "miembro" && project.id_miembro_propietario === tokenData.id;
    const isAdmin = tokenData.role === "admin";

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Verificar que el proyecto es privado
    if (project.visibilidad !== "privado") {
      return NextResponse.json(
        { error: "El proyecto ya es publico" },
        { status: 400 }
      );
    }

    // Verificar que el proyecto está en un estado que permite publicación
    const allowedStates = ["borrador", "iniciado", "en_implementacion", "en_pruebas"];
    if (!allowedStates.includes(project.estado)) {
      return NextResponse.json(
        { error: `No se puede publicar un proyecto en estado: ${project.estado}` },
        { status: 400 }
      );
    }

    // Actualizar visibilidad y estado
    await query(
      `UPDATE projects
       SET visibilidad = 'publico',
           estado = 'publicado',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({
      message: "Proyecto publicado exitosamente",
      visibilidad: "publico",
      estado: "publicado"
    });
  } catch (error) {
    console.error("Error publishing project:", error);
    return NextResponse.json(
      { error: "Error al publicar proyecto" },
      { status: 500 }
    );
  }
}
