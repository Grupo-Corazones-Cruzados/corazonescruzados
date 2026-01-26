import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/tickets/[id] - Get a single ticket with slots and acciones
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const ticketId = parseInt(id);

    // Get ticket with relations
    const ticketResult = await query(
      `SELECT
        t.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto, 'puesto', m.puesto, 'costo', m.costo) as miembro,
        json_build_object('id', a.id, 'nombre', a.nombre) as accion
      FROM tickets t
      LEFT JOIN clientes c ON t.id_cliente = c.id
      LEFT JOIN miembros m ON t.id_miembro = m.id
      LEFT JOIN acciones a ON t.id_accion = a.id
      WHERE t.id = $1`,
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const ticket = ticketResult.rows[0];

    // Get slots
    const slotsResult = await query(
      "SELECT * FROM ticket_slots WHERE id_ticket = $1 ORDER BY fecha ASC",
      [ticketId]
    );

    // Get acciones
    const accionesResult = await query(
      `SELECT ta.*, json_build_object('id', a.id, 'nombre', a.nombre) as accion
       FROM ticket_acciones ta
       LEFT JOIN acciones a ON ta.id_accion = a.id
       WHERE ta.id_ticket = $1`,
      [ticketId]
    );

    return NextResponse.json({
      ticket,
      slots: slotsResult.rows,
      acciones: accionesResult.rows,
    });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json({ error: "Error al cargar el ticket" }, { status: 500 });
  }
}

// PATCH /api/tickets/[id] - Update a ticket
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const ticketId = parseInt(id);
    const body = await request.json();

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      "titulo",
      "detalle",
      "estado",
      "id_miembro",
      "horas_estimadas",
      "horas_reales",
      "costo_estimado",
      "costo_real",
      "fecha_programada",
      "fecha_fin",
      "google_event_id",
      "google_meet_link",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(ticketId);
    const sql = `UPDATE tickets SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ticket: result.rows[0] });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json({ error: "Error al actualizar el ticket" }, { status: 500 });
  }
}

// DELETE /api/tickets/[id] - Delete a ticket
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const ticketId = parseInt(id);

    // Check if user has permission (admin only)
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await query("DELETE FROM tickets WHERE id = $1", [ticketId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json({ error: "Error al eliminar el ticket" }, { status: 500 });
  }
}
