import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/tickets/[id]/slots - Get slots for a ticket
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const ticketId = parseInt(id);

    const result = await query(
      "SELECT * FROM ticket_slots WHERE id_ticket = $1 ORDER BY fecha ASC, hora_inicio ASC",
      [ticketId]
    );

    return NextResponse.json({ slots: result.rows });
  } catch (error) {
    console.error("Error fetching slots:", error);
    return NextResponse.json({ error: "Error al cargar los slots" }, { status: 500 });
  }
}

// POST /api/tickets/[id]/slots - Add a slot to a ticket
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const ticketId = parseInt(id);
    const body = await request.json();
    const { fecha, hora_inicio, hora_fin } = body;

    if (!fecha || !hora_inicio || !hora_fin) {
      return NextResponse.json(
        { error: "Fecha, hora de inicio y hora de fin son requeridos" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO ticket_slots (id_ticket, fecha, hora_inicio, hora_fin, estado)
       VALUES ($1, $2, $3, $4, 'pendiente')
       RETURNING *`,
      [ticketId, fecha, hora_inicio, hora_fin]
    );

    return NextResponse.json({ slot: result.rows[0] });
  } catch (error) {
    console.error("Error creating slot:", error);
    return NextResponse.json({ error: "Error al crear el slot" }, { status: 500 });
  }
}

// PATCH /api/tickets/[id]/slots - Update a slot
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { slotId, ...updates } = body;

    if (!slotId) {
      return NextResponse.json({ error: "ID del slot es requerido" }, { status: 400 });
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ["fecha", "hora_inicio", "hora_fin", "estado", "duracion_real", "notas"];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(slotId);
    const sql = `UPDATE ticket_slots SET ${updateFields.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Slot no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ slot: result.rows[0] });
  } catch (error) {
    console.error("Error updating slot:", error);
    return NextResponse.json({ error: "Error al actualizar el slot" }, { status: 500 });
  }
}

// DELETE /api/tickets/[id]/slots - Delete a slot
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json({ error: "ID del slot es requerido" }, { status: 400 });
    }

    await query("DELETE FROM ticket_slots WHERE id = $1", [parseInt(slotId)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting slot:", error);
    return NextResponse.json({ error: "Error al eliminar el slot" }, { status: 500 });
  }
}
