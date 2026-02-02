import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { ProjectPdfDocument } from "@/lib/pdf/projectPdf";
import React from "react";

type RouteContext = { params: Promise<{ id: string }> };

// GET - Generar y descargar PDF del proyecto
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

    // Obtener proyecto
    const projectResult = await query(
      `SELECT p.*,
              c.nombre as cliente_nombre,
              m.nombre as miembro_propietario_nombre,
              m.puesto as miembro_propietario_puesto
       FROM projects p
       LEFT JOIN clientes c ON p.id_cliente = c.id
       LEFT JOIN miembros m ON p.id_miembro_propietario = m.id
       WHERE p.id = $1`,
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

    // Verificar permisos
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

    // Verificar si es miembro del equipo
    let isTeamMember = false;
    if ((userRole === "miembro" || userRole === "admin") && userMemberId) {
      const bidResult = await query(
        `SELECT id FROM project_bids
         WHERE id_project = $1 AND id_miembro = $2 AND estado = 'aceptada'
           AND (removido IS NULL OR removido = FALSE)`,
        [id, userMemberId]
      );
      isTeamMember = bidResult.rows.length > 0;
    }

    if (!isClientOwner && !isMemberOwner && !isAdmin && !isTeamMember) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Obtener requerimientos
    const requirementsResult = await query(
      `SELECT
        r.*,
        mc.nombre as completado_por_nombre,
        CASE
          WHEN r.creado_por_miembro_id IS NOT NULL THEN mm.nombre
          WHEN r.creado_por_cliente_id IS NOT NULL THEN cc.nombre
          ELSE NULL
        END as creador_nombre,
        CASE
          WHEN r.creado_por_miembro_id IS NOT NULL THEN 'miembro'
          WHEN r.creado_por_cliente_id IS NOT NULL THEN 'cliente'
          ELSE NULL
        END as creador_tipo
      FROM project_requirements r
      LEFT JOIN miembros mc ON r.completado_por = mc.id
      LEFT JOIN miembros mm ON r.creado_por_miembro_id = mm.id
      LEFT JOIN clientes cc ON r.creado_por_cliente_id = cc.id
      WHERE r.id_project = $1
      ORDER BY r.id ASC`,
      [id]
    );

    // Obtener equipo
    const teamResult = await query(
      `SELECT
        m.nombre,
        m.puesto,
        b.monto_acordado
       FROM project_bids b
       JOIN miembros m ON b.id_miembro = m.id
       WHERE b.id_project = $1
         AND b.estado = 'aceptada'
         AND (b.removido IS NULL OR b.removido = FALSE)
       ORDER BY b.fecha_aceptacion ASC`,
      [id]
    );

    // Preparar datos para el PDF
    const pdfProject = {
      id: project.id,
      titulo: project.titulo,
      descripcion: project.descripcion,
      estado: project.estado,
      fecha_limite: project.fecha_limite,
      created_at: project.created_at,
      presupuesto_min: project.presupuesto_min,
      presupuesto_max: project.presupuesto_max,
    };

    const pdfRequirements = requirementsResult.rows.map((r: {
      titulo: string;
      descripcion?: string;
      costo?: number;
      completado: boolean;
      creador_nombre?: string;
      creador_tipo?: string;
      completado_por_nombre?: string;
    }) => ({
      titulo: r.titulo,
      descripcion: r.descripcion,
      costo: r.costo,
      completado: r.completado,
      creador: r.creador_nombre ? {
        nombre: r.creador_nombre,
        tipo: r.creador_tipo || 'desconocido'
      } : undefined,
      miembro_completado: r.completado_por_nombre ? {
        nombre: r.completado_por_nombre
      } : undefined,
    }));

    const pdfTeam = teamResult.rows.map((t: {
      nombre: string;
      puesto?: string;
      monto_acordado?: number;
    }) => ({
      nombre: t.nombre,
      puesto: t.puesto,
      monto_acordado: t.monto_acordado,
    }));

    const propietario = project.id_miembro_propietario ? {
      nombre: project.miembro_propietario_nombre,
      tipo: 'miembro'
    } : undefined;

    const clienteNombre = project.cliente_nombre || project.cliente_externo_nombre;

    // Generar PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(ProjectPdfDocument, {
        project: pdfProject,
        requirements: pdfRequirements,
        team: pdfTeam,
        propietario,
        clienteNombre,
      })
    );

    // Crear nombre de archivo seguro
    const safeTitle = project.titulo
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    const filename = `Proyecto_${project.id}_${safeTitle}.pdf`;

    // Retornar PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Error al generar PDF" },
      { status: 500 }
    );
  }
}
