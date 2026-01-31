import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import crypto from "crypto";
import { sendProjectCreatedToExternalClient } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

// PUT - Establecer cliente externo (email + nombre)
export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Solo miembros pueden establecer clientes externos
    if (tokenData.role !== "miembro" && tokenData.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { email, nombre, enviar_email = true } = body;

    if (!email || !nombre) {
      return NextResponse.json(
        { error: "Email y nombre son requeridos" },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato de email invalido" },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe y el miembro es propietario
    const projectResult = await query(
      `SELECT p.*, m.nombre as propietario_nombre
       FROM projects p
       LEFT JOIN miembros m ON p.id_miembro_propietario = m.id
       WHERE p.id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar que es el propietario del proyecto o admin
    if (project.id_miembro_propietario !== tokenData.id && tokenData.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Verificar que el proyecto es de tipo miembro y privado
    if (project.tipo_proyecto !== "miembro") {
      return NextResponse.json(
        { error: "Solo se puede asignar cliente externo a proyectos de miembro" },
        { status: 400 }
      );
    }

    // No se puede tener cliente registrado y externo al mismo tiempo
    if (project.id_cliente) {
      return NextResponse.json(
        { error: "El proyecto ya tiene un cliente registrado" },
        { status: 400 }
      );
    }

    // Generar share token si no existe (para enviar al cliente)
    let shareToken = project.share_token;
    if (!shareToken) {
      shareToken = crypto.randomBytes(32).toString("hex");
      await query(
        `UPDATE projects
         SET share_token = $1,
             share_token_created_at = NOW()
         WHERE id = $2`,
        [shareToken, id]
      );
    }

    // Actualizar cliente externo
    await query(
      `UPDATE projects
       SET cliente_externo_email = $1,
           cliente_externo_nombre = $2
       WHERE id = $3`,
      [email.toLowerCase().trim(), nombre.trim(), id]
    );

    // Enviar email al cliente externo
    if (enviar_email) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const shareUrl = `${APP_URL}/p/${shareToken}`;

      await sendProjectCreatedToExternalClient(
        email,
        nombre,
        {
          id: project.id,
          titulo: project.titulo,
          descripcion: project.descripcion
        },
        shareUrl,
        project.propietario_nombre || "El equipo"
      );
    }

    return NextResponse.json({
      message: "Cliente externo establecido",
      cliente_externo_email: email.toLowerCase().trim(),
      cliente_externo_nombre: nombre.trim()
    });
  } catch (error) {
    console.error("Error setting external client:", error);
    return NextResponse.json(
      { error: "Error al establecer cliente externo" },
      { status: 500 }
    );
  }
}

// DELETE - Remover cliente externo
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (tokenData.role !== "miembro" && tokenData.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await context.params;

    // Verificar que el proyecto existe
    const projectResult = await query(
      `SELECT id, id_miembro_propietario FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar permisos
    if (project.id_miembro_propietario !== tokenData.id && tokenData.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Remover cliente externo
    await query(
      `UPDATE projects
       SET cliente_externo_email = NULL,
           cliente_externo_nombre = NULL
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ message: "Cliente externo removido" });
  } catch (error) {
    console.error("Error removing external client:", error);
    return NextResponse.json(
      { error: "Error al remover cliente externo" },
      { status: 500 }
    );
  }
}

// PATCH - Asociar cliente registrado (reemplaza cliente externo)
export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (tokenData.role !== "miembro" && tokenData.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { id_cliente } = body;

    if (!id_cliente) {
      return NextResponse.json(
        { error: "ID de cliente requerido" },
        { status: 400 }
      );
    }

    // Verificar que el proyecto existe
    const projectResult = await query(
      `SELECT id, id_miembro_propietario, tipo_proyecto FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar permisos
    if (project.id_miembro_propietario !== tokenData.id && tokenData.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Verificar que el cliente existe
    const clientResult = await query(
      `SELECT id, nombre FROM clientes WHERE id = $1`,
      [id_cliente]
    );

    if (clientResult.rows.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // Actualizar proyecto: asociar cliente registrado y limpiar cliente externo
    await query(
      `UPDATE projects
       SET id_cliente = $1,
           cliente_externo_email = NULL,
           cliente_externo_nombre = NULL
       WHERE id = $2`,
      [id_cliente, id]
    );

    return NextResponse.json({
      message: "Cliente asociado exitosamente",
      cliente: clientResult.rows[0]
    });
  } catch (error) {
    console.error("Error associating registered client:", error);
    return NextResponse.json(
      { error: "Error al asociar cliente" },
      { status: 500 }
    );
  }
}
