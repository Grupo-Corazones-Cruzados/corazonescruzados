import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess, getActiveRestriction } from "@/lib/reclutamiento";

// GET /api/reclutamiento/eventos/[id]/invitaciones - List invitations for event
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    const result = await query(
      `SELECT ei.id, ei.created_at, ei.participo, ei.id_postulacion,
              p.motivo, p.id_usuario,
              up.nombre, up.apellido, up.email, up.avatar_url,
              inv.nombre as invitado_por_nombre, inv.apellido as invitado_por_apellido
       FROM evento_invitaciones ei
       JOIN postulaciones p ON ei.id_postulacion = p.id
       JOIN user_profiles up ON p.id_usuario = up.id
       JOIN user_profiles inv ON ei.invitado_por = inv.id
       WHERE ei.id_evento = $1
       ORDER BY ei.created_at DESC`,
      [id]
    );

    return NextResponse.json({ invitaciones: result.rows });
  } catch (error) {
    console.error("Error fetching invitaciones:", error);
    return NextResponse.json(
      { error: "Error al cargar invitaciones" },
      { status: 500 }
    );
  }
}

// POST /api/reclutamiento/eventos/[id]/invitaciones - Invite postulante to event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { id_postulacion } = body;

    if (!id_postulacion) {
      return NextResponse.json(
        { error: "ID de postulación requerido" },
        { status: 400 }
      );
    }

    // Check the event exists
    const eventoResult = await query(
      `SELECT id FROM eventos_reclutamiento WHERE id = $1`,
      [id]
    );
    if (eventoResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Evento no encontrado" },
        { status: 404 }
      );
    }

    // Check the postulación has no active restriction
    const restriction = await getActiveRestriction(Number(id_postulacion));
    if (restriction) {
      return NextResponse.json(
        { error: "Este aspirante tiene una restricción activa" },
        { status: 400 }
      );
    }

    // Check if already invited
    const existing = await query(
      `SELECT id FROM evento_invitaciones WHERE id_evento = $1 AND id_postulacion = $2`,
      [id, id_postulacion]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Este aspirante ya fue invitado a este evento" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO evento_invitaciones (id_evento, id_postulacion, invitado_por)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, id_postulacion, tokenData.userId]
    );

    return NextResponse.json({ invitacion: result.rows[0] });
  } catch (error) {
    console.error("Error creating invitación:", error);
    return NextResponse.json(
      { error: "Error al crear invitación" },
      { status: 500 }
    );
  }
}
