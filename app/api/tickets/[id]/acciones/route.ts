import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/tickets/[id]/acciones - Get acciones for a ticket
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const ticketId = parseInt(id);

    const result = await query(
      `SELECT ta.*, json_build_object('id', a.id, 'nombre', a.nombre) as accion
       FROM ticket_acciones ta
       LEFT JOIN acciones a ON ta.id_accion = a.id
       WHERE ta.id_ticket = $1`,
      [ticketId]
    );

    return NextResponse.json({ acciones: result.rows });
  } catch (error) {
    console.error("Error fetching acciones:", error);
    return NextResponse.json({ error: "Error al cargar las acciones" }, { status: 500 });
  }
}

// POST /api/tickets/[id]/acciones - Add an accion to a ticket
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const ticketId = parseInt(id);
    const body = await request.json();
    const { id_accion, horas_asignadas, costo_hora } = body;

    if (!id_accion || !horas_asignadas || !costo_hora) {
      return NextResponse.json(
        { error: "Acción, horas asignadas y costo por hora son requeridos" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO ticket_acciones (id_ticket, id_accion, horas_asignadas, costo_hora)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticketId, id_accion, horas_asignadas, costo_hora]
    );

    return NextResponse.json({ accion: result.rows[0] });
  } catch (error) {
    console.error("Error creating accion:", error);
    return NextResponse.json({ error: "Error al crear la acción" }, { status: 500 });
  }
}

// DELETE /api/tickets/[id]/acciones - Delete an accion
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accionId = searchParams.get("accionId");

    if (!accionId) {
      return NextResponse.json({ error: "ID de la acción es requerido" }, { status: 400 });
    }

    await query("DELETE FROM ticket_acciones WHERE id = $1", [parseInt(accionId)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting accion:", error);
    return NextResponse.json({ error: "Error al eliminar la acción" }, { status: 500 });
  }
}
