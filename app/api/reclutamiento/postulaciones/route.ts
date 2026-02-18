import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess, getUserRestriction } from "@/lib/reclutamiento";

// GET /api/reclutamiento/postulaciones - List postulaciones (reclutador/admin)
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await query(
      `SELECT p.id, p.created_at, p.motivo, p.id_usuario,
              up.nombre, up.apellido, up.email, up.avatar_url,
              CASE
                WHEN EXISTS (
                  SELECT 1 FROM restricciones_reclutamiento r
                  WHERE r.id_postulacion = p.id AND r.levantado = FALSE
                    AND (r.tipo = 'permanente' OR (r.tipo = 'temporal' AND r.fecha_expiracion > NOW()))
                ) THEN 'restringido'
                ELSE 'activo'
              END as estado
       FROM postulaciones p
       JOIN user_profiles up ON p.id_usuario = up.id
       ORDER BY p.created_at DESC`
    );

    return NextResponse.json({ postulaciones: result.rows });
  } catch (error) {
    console.error("Error fetching postulaciones:", error);
    return NextResponse.json(
      { error: "Error al cargar postulaciones" },
      { status: 500 }
    );
  }
}

// POST /api/reclutamiento/postulaciones - Submit postulación (cliente)
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check for active restriction
    const restriction = await getUserRestriction(tokenData.userId);
    if (restriction) {
      return NextResponse.json(
        { error: "Tu postulación está restringida", restriccion: restriction },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { motivo } = body;

    if (!motivo || motivo.trim().length === 0) {
      return NextResponse.json(
        { error: "El motivo es requerido" },
        { status: 400 }
      );
    }

    if (motivo.length > 2000) {
      return NextResponse.json(
        { error: "El motivo no puede exceder 2000 caracteres" },
        { status: 400 }
      );
    }

    // Check if already has a postulación
    const existing = await query(
      `SELECT id FROM postulaciones WHERE id_usuario = $1`,
      [tokenData.userId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya tienes una postulación activa" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO postulaciones (id_usuario, motivo)
       VALUES ($1, $2)
       RETURNING id, created_at, motivo`,
      [tokenData.userId, motivo.trim()]
    );

    return NextResponse.json({ postulacion: result.rows[0] });
  } catch (error) {
    console.error("Error creating postulación:", error);
    return NextResponse.json(
      { error: "Error al crear postulación" },
      { status: 500 }
    );
  }
}
