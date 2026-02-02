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

    // Get user info
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const userRole = userResult.rows[0].rol;
    const userMiembroId = userResult.rows[0].id_miembro;

    // Verificar permisos (solo el propietario puede publicar)
    // For client owner check, we need to match via email since id_cliente references clientes table
    let isClientOwner = false;
    if (userRole === "cliente" && project.id_cliente) {
      const clientCheck = await query(
        `SELECT c.id FROM clientes c
         JOIN user_profiles up ON LOWER(up.email) = LOWER(c.correo_electronico)
         WHERE up.id = $1 AND c.id = $2`,
        [tokenData.userId, project.id_cliente]
      );
      isClientOwner = clientCheck.rows.length > 0;
    }

    const projectOwnerId = project.id_miembro_propietario ? Number(project.id_miembro_propietario) : null;
    const userMemberId = userMiembroId ? Number(userMiembroId) : null;
    const isMemberOwner = (userRole === "miembro" || userRole === "admin") && projectOwnerId !== null && projectOwnerId === userMemberId;
    const isAdmin = userRole === "admin";

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
