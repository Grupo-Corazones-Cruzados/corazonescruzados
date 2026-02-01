import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/tickets - Get all tickets for admin
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user is admin
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const estado = searchParams.get("estado") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build WHERE clauses
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(t.titulo ILIKE $${paramIndex} OR c.nombre ILIKE $${paramIndex} OR m.nombre ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    if (estado) {
      conditions.push(`t.estado = $${paramIndex}`);
      values.push(estado);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM tickets t
       LEFT JOIN clientes c ON t.id_cliente = c.id
       LEFT JOIN miembros m ON t.id_miembro = m.id
       ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total);

    // Get tickets with client and member info
    const ticketsResult = await query(
      `SELECT
        t.id,
        t.titulo,
        t.detalle,
        t.estado,
        t.horas_estimadas,
        t.horas_reales,
        t.costo_estimado,
        t.costo_real,
        t.fecha_programada,
        t.fecha_fin,
        t.created_at,
        t.google_meet_link,
        c.nombre as cliente_nombre,
        c.correo_electronico as cliente_email,
        m.nombre as miembro_nombre,
        m.puesto as miembro_puesto,
        a.nombre as accion_nombre,
        (SELECT COUNT(*) FROM ticket_slots ts WHERE ts.id_ticket = t.id) as total_slots,
        (SELECT COUNT(*) FROM ticket_acciones ta WHERE ta.id_ticket = t.id) as total_acciones
       FROM tickets t
       LEFT JOIN clientes c ON t.id_cliente = c.id
       LEFT JOIN miembros m ON t.id_miembro = m.id
       LEFT JOIN acciones a ON t.id_accion = a.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return NextResponse.json({
      tickets: ticketsResult.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching admin tickets:", error);
    return NextResponse.json({ error: "Error al cargar tickets" }, { status: 500 });
  }
}

// DELETE /api/admin/tickets - Delete a ticket (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if user is admin
    const userResult = await query(
      "SELECT rol FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("id");

    if (!ticketId) {
      return NextResponse.json({ error: "ID de ticket requerido" }, { status: 400 });
    }

    // Get ticket info before deletion
    const ticketResult = await query(
      "SELECT id, titulo FROM tickets WHERE id = $1",
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const ticket = ticketResult.rows[0];

    // Delete the ticket (cascades will handle related records like ticket_slots, ticket_acciones)
    await query("DELETE FROM tickets WHERE id = $1", [ticketId]);

    return NextResponse.json({
      success: true,
      message: `Ticket "${ticket.titulo}" eliminado correctamente`,
    });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json({ error: "Error al eliminar ticket" }, { status: 500 });
  }
}
