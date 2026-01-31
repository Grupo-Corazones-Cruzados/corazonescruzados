import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import crypto from "crypto";

type RouteContext = { params: Promise<{ id: string }> };

// GET - Obtener información del enlace compartible actual
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verificar que el usuario tiene acceso al proyecto
    const projectResult = await query(
      `SELECT id, share_token, share_token_created_at, share_token_expires_at,
              id_cliente, id_miembro_propietario
       FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar permisos (solo propietario puede ver/gestionar el token)
    const isClientOwner = tokenData.role === "cliente" && project.id_cliente === tokenData.id;
    const isMemberOwner = tokenData.role === "miembro" && project.id_miembro_propietario === tokenData.id;
    const isAdmin = tokenData.role === "admin";

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (!project.share_token) {
      return NextResponse.json({ share_token: null });
    }

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${APP_URL}/p/${project.share_token}`;

    // Verificar si ha expirado
    const isExpired = project.share_token_expires_at && new Date(project.share_token_expires_at) < new Date();

    return NextResponse.json({
      share_token: project.share_token,
      share_url: shareUrl,
      created_at: project.share_token_created_at,
      expires_at: project.share_token_expires_at,
      is_expired: isExpired,
      is_permanent: !project.share_token_expires_at
    });
  } catch (error) {
    console.error("Error getting share token:", error);
    return NextResponse.json({ error: "Error al obtener enlace" }, { status: 500 });
  }
}

// POST - Generar nuevo token compartible
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
    const body = await request.json().catch(() => ({}));
    const { expiracion = "30d" } = body; // 7d, 30d, 90d, permanente

    // Verificar que el usuario tiene acceso al proyecto
    const projectResult = await query(
      `SELECT id, id_cliente, id_miembro_propietario
       FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar permisos
    const isClientOwner = tokenData.role === "cliente" && project.id_cliente === tokenData.id;
    const isMemberOwner = tokenData.role === "miembro" && project.id_miembro_propietario === tokenData.id;
    const isAdmin = tokenData.role === "admin";

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Generar token único
    const shareToken = crypto.randomBytes(32).toString("hex");

    // Calcular fecha de expiración
    let expiresAt: Date | null = null;
    const now = new Date();

    switch (expiracion) {
      case "7d":
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        break;
      case "permanente":
        expiresAt = null;
        break;
      default:
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Actualizar proyecto con nuevo token
    await query(
      `UPDATE projects
       SET share_token = $1,
           share_token_created_at = NOW(),
           share_token_expires_at = $2
       WHERE id = $3`,
      [shareToken, expiresAt, id]
    );

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${APP_URL}/p/${shareToken}`;

    return NextResponse.json({
      share_token: shareToken,
      share_url: shareUrl,
      created_at: now.toISOString(),
      expires_at: expiresAt?.toISOString() || null,
      is_permanent: !expiresAt
    });
  } catch (error) {
    console.error("Error generating share token:", error);
    return NextResponse.json({ error: "Error al generar enlace" }, { status: 500 });
  }
}

// DELETE - Revocar token compartible
export async function DELETE(
  request: Request,
  context: RouteContext
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;

    // Verificar que el usuario tiene acceso al proyecto
    const projectResult = await query(
      `SELECT id, id_cliente, id_miembro_propietario
       FROM projects WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Verificar permisos
    const isClientOwner = tokenData.role === "cliente" && project.id_cliente === tokenData.id;
    const isMemberOwner = tokenData.role === "miembro" && project.id_miembro_propietario === tokenData.id;
    const isAdmin = tokenData.role === "admin";

    if (!isClientOwner && !isMemberOwner && !isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Revocar token
    await query(
      `UPDATE projects
       SET share_token = NULL,
           share_token_created_at = NULL,
           share_token_expires_at = NULL
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ message: "Enlace revocado exitosamente" });
  } catch (error) {
    console.error("Error revoking share token:", error);
    return NextResponse.json({ error: "Error al revocar enlace" }, { status: 500 });
  }
}
