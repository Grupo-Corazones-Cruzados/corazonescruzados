import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/members/[id]/availability - Get member availability, exceptions, and booked slots
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const miembroId = parseInt(id);

    // Get weekly availability
    const availabilityResult = await query(
      `SELECT * FROM member_availability
       WHERE id_miembro = $1 AND activo = true
       ORDER BY dia_semana ASC`,
      [miembroId]
    );

    // Get exceptions for next 60 days
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 60);

    const exceptionsResult = await query(
      `SELECT * FROM availability_exceptions
       WHERE id_miembro = $1 AND fecha >= $2 AND fecha <= $3
       ORDER BY fecha ASC`,
      [miembroId, today.toISOString().split("T")[0], endDate.toISOString().split("T")[0]]
    );

    // Get booked slots
    const slotsResult = await query(
      `SELECT ts.id, ts.id_ticket, ts.fecha, ts.hora_inicio, ts.hora_fin, ts.estado
       FROM ticket_slots ts
       JOIN tickets t ON ts.id_ticket = t.id
       WHERE t.id_miembro = $1
       AND ts.fecha >= $2
       AND ts.estado != 'cancelado'
       ORDER BY ts.fecha ASC`,
      [miembroId, today.toISOString().split("T")[0]]
    );

    return NextResponse.json({
      availability: availabilityResult.rows,
      exceptions: exceptionsResult.rows,
      bookedSlots: slotsResult.rows,
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json({ error: "Error al cargar la disponibilidad" }, { status: 500 });
  }
}

// POST /api/members/[id]/availability - Save weekly availability
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const miembroId = parseInt(id);
    const body = await request.json();
    const { slots } = body;

    // Verify user has permission
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { rol, id_miembro } = userResult.rows[0];
    if (rol !== "admin" && id_miembro !== miembroId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await transaction(async (client) => {
      // Delete existing availability
      await client.query("DELETE FROM member_availability WHERE id_miembro = $1", [miembroId]);

      // Insert new availability
      if (slots && slots.length > 0) {
        for (const slot of slots) {
          await client.query(
            `INSERT INTO member_availability (id_miembro, dia_semana, hora_inicio, hora_fin, activo)
             VALUES ($1, $2, $3, $4, true)`,
            [miembroId, slot.dia_semana, slot.hora_inicio, slot.hora_fin]
          );
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving availability:", error);
    return NextResponse.json({ error: "Error al guardar la disponibilidad" }, { status: 500 });
  }
}
