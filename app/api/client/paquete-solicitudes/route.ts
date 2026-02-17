import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/client/paquete-solicitudes - List client solicitudes with stats
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const solicitudesResult = await query(
      `SELECT
        ps.*,
        p.nombre as tier_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pa.id,
              'id_miembro', pa.id_miembro,
              'horas_asignadas', pa.horas_asignadas,
              'horas_consumidas', pa.horas_consumidas,
              'estado', pa.estado,
              'miembro', json_build_object(
                'id', m.id,
                'nombre', m.nombre,
                'foto', m.foto,
                'puesto', m.puesto
              )
            )
          ) FILTER (WHERE pa.id IS NOT NULL),
          '[]'
        ) as asignaciones
      FROM paquete_solicitudes ps
      LEFT JOIN paquetes p ON ps.id_paquete_tier = p.id
      LEFT JOIN paquete_asignaciones pa ON pa.id_solicitud = ps.id
      LEFT JOIN miembros m ON pa.id_miembro = m.id
      WHERE ps.id_cliente = $1
      GROUP BY ps.id, p.nombre
      ORDER BY ps.created_at DESC`,
      [tokenData.userId]
    );

    const solicitudes = solicitudesResult.rows;

    // Calculate stats
    const stats = {
      total: solicitudes.length,
      pendientes: solicitudes.filter((s: any) => ["borrador", "pendiente", "parcial"].includes(s.estado)).length,
      en_progreso: solicitudes.filter((s: any) => s.estado === "en_progreso").length,
      completados: solicitudes.filter((s: any) => s.estado === "completado").length,
    };

    return NextResponse.json({ solicitudes, stats });
  } catch (error) {
    console.error("Error fetching solicitudes:", error);
    return NextResponse.json(
      { error: "Error al cargar las solicitudes" },
      { status: 500 }
    );
  }
}

// POST /api/client/paquete-solicitudes - Create solicitud + asignaciones
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { horas_totales, notas_cliente, asignaciones } = body;

    if (!horas_totales || horas_totales <= 0) {
      return NextResponse.json(
        { error: "Las horas totales deben ser mayor a 0" },
        { status: 400 }
      );
    }

    if (!asignaciones || !Array.isArray(asignaciones) || asignaciones.length === 0) {
      return NextResponse.json(
        { error: "Debe incluir al menos una asignacion" },
        { status: 400 }
      );
    }

    // Validate total assigned hours
    const totalAsignadas = asignaciones.reduce((sum: number, a: any) => sum + (a.horas_asignadas || 0), 0);
    if (totalAsignadas > horas_totales) {
      return NextResponse.json(
        { error: "Las horas asignadas no pueden superar las horas totales" },
        { status: 400 }
      );
    }

    // Calculate tier/discount from paquetes table
    const tierResult = await query(
      `SELECT id, nombre, horas, descuento FROM paquetes ORDER BY horas DESC`
    );

    let tierId = null;
    let descuento = 0;
    for (const tier of tierResult.rows) {
      if (horas_totales >= Number(tier.horas)) {
        tierId = tier.id;
        descuento = Number(tier.descuento);
        break;
      }
    }

    // Create solicitud
    const solicitudResult = await query(
      `INSERT INTO paquete_solicitudes (id_cliente, horas_totales, costo_hora, descuento, id_paquete_tier, estado, notas_cliente)
       VALUES ($1, $2, 10.00, $3, $4, 'pendiente', $5)
       RETURNING *`,
      [tokenData.userId, horas_totales, descuento, tierId, notas_cliente || null]
    );

    const solicitud = solicitudResult.rows[0];

    // Create asignaciones
    for (const asig of asignaciones) {
      await query(
        `INSERT INTO paquete_asignaciones (id_solicitud, id_miembro, horas_asignadas, descripcion_tarea, dias_semana, estado)
         VALUES ($1, $2, $3, $4, $5, 'pendiente')`,
        [
          solicitud.id,
          asig.id_miembro,
          asig.horas_asignadas,
          asig.descripcion_tarea || null,
          JSON.stringify(asig.dias_semana || []),
        ]
      );
    }

    return NextResponse.json({ solicitud }, { status: 201 });
  } catch (error) {
    console.error("Error creating solicitud:", error);
    return NextResponse.json(
      { error: "Error al crear la solicitud" },
      { status: 500 }
    );
  }
}
