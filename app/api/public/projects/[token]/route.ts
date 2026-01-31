import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ token: string }> };

// GET - Obtener proyecto por token público (sin autenticación)
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: "Token requerido" },
        { status: 400 }
      );
    }

    // Buscar proyecto por token
    const projectResult = await query(
      `SELECT
        p.*,
        c.nombre as cliente_nombre,
        c.email as cliente_email,
        m.nombre as miembro_propietario_nombre,
        m.puesto as miembro_propietario_puesto,
        m.foto as miembro_propietario_foto
      FROM projects p
      LEFT JOIN clientes c ON p.id_cliente = c.id
      LEFT JOIN miembros m ON p.id_miembro_propietario = m.id
      WHERE p.share_token = $1`,
      [token]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Proyecto no encontrado o enlace invalido" },
        { status: 404 }
      );
    }

    const project = projectResult.rows[0];

    // Verificar si el token ha expirado
    if (project.share_token_expires_at && new Date(project.share_token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: "El enlace ha expirado" },
        { status: 410 }
      );
    }

    // Obtener requerimientos del proyecto
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
      [project.id]
    );

    // Obtener equipo (bids aceptados y no removidos)
    const teamResult = await query(
      `SELECT
        b.id as bid_id,
        b.monto_acordado,
        b.confirmado_por_miembro,
        b.trabajo_finalizado,
        m.id as miembro_id,
        m.nombre as miembro_nombre,
        m.puesto as miembro_puesto,
        m.foto as miembro_foto
      FROM project_bids b
      JOIN miembros m ON b.id_miembro = m.id
      WHERE b.id_project = $1
        AND b.estado = 'aceptada'
        AND (b.removido IS NULL OR b.removido = FALSE)
      ORDER BY b.fecha_aceptacion ASC`,
      [project.id]
    );

    // Calcular progreso
    const requirements = requirementsResult.rows;
    const totalRequirements = requirements.length;
    const completedRequirements = requirements.filter((r: { completado: boolean }) => r.completado).length;
    const progress = totalRequirements > 0
      ? Math.round((completedRequirements / totalRequirements) * 100)
      : 0;

    // Calcular costo total
    const totalCost = requirements.reduce((sum: number, r: { costo?: number }) => sum + Number(r.costo || 0), 0);

    // Preparar respuesta (solo lectura, datos limitados)
    const publicProject = {
      id: project.id,
      titulo: project.titulo,
      descripcion: project.descripcion,
      estado: project.estado,
      fecha_limite: project.fecha_limite,
      created_at: project.created_at,
      tipo_proyecto: project.tipo_proyecto,
      // Info del propietario
      propietario: project.id_miembro_propietario ? {
        nombre: project.miembro_propietario_nombre,
        puesto: project.miembro_propietario_puesto,
        foto: project.miembro_propietario_foto,
      } : project.id_cliente ? {
        nombre: project.cliente_nombre,
        tipo: 'cliente'
      } : project.cliente_externo_nombre ? {
        nombre: project.cliente_externo_nombre,
        tipo: 'cliente_externo'
      } : null,
      // Estadísticas
      progress,
      totalRequirements,
      completedRequirements,
      totalCost,
      // Requerimientos (sin info sensible)
      requirements: requirements.map((r: {
        id: number;
        titulo: string;
        descripcion?: string;
        costo?: number;
        completado: boolean;
        fecha_completado?: string;
        creador_nombre?: string;
        creador_tipo?: string;
        completado_por_nombre?: string;
        es_adicional?: boolean;
      }) => ({
        id: r.id,
        titulo: r.titulo,
        descripcion: r.descripcion,
        costo: r.costo,
        completado: r.completado,
        fecha_completado: r.fecha_completado,
        creador: r.creador_nombre ? {
          nombre: r.creador_nombre,
          tipo: r.creador_tipo
        } : null,
        completado_por: r.completado_por_nombre ? {
          nombre: r.completado_por_nombre
        } : null,
        es_adicional: r.es_adicional
      })),
      // Equipo
      team: teamResult.rows.map((t: {
        miembro_id: number;
        miembro_nombre: string;
        miembro_puesto?: string;
        miembro_foto?: string;
        trabajo_finalizado?: boolean;
      }) => ({
        id: t.miembro_id,
        nombre: t.miembro_nombre,
        puesto: t.miembro_puesto,
        foto: t.miembro_foto,
        trabajo_finalizado: t.trabajo_finalizado
      }))
    };

    return NextResponse.json(publicProject);
  } catch (error) {
    console.error("Error fetching public project:", error);
    return NextResponse.json(
      { error: "Error al obtener proyecto" },
      { status: 500 }
    );
  }
}
