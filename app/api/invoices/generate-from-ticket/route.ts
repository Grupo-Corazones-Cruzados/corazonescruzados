import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/invoices/generate-from-ticket - Generate invoice from a ticket
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { ticketId } = body;

    if (!ticketId) {
      return NextResponse.json({ error: "ID del ticket es requerido" }, { status: 400 });
    }

    // Fetch ticket with relations
    const ticketResult = await query(
      `SELECT
        t.id, t.titulo, t.horas_reales, t.costo_real, t.id_cliente, t.id_miembro,
        m.costo as miembro_costo
       FROM tickets t
       LEFT JOIN miembros m ON t.id_miembro = m.id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const ticket = ticketResult.rows[0];

    // Fetch ticket acciones
    const accionesResult = await query(
      `SELECT ta.*, a.nombre as accion_nombre
       FROM ticket_acciones ta
       LEFT JOIN acciones a ON ta.id_accion = a.id
       WHERE ta.id_ticket = $1`,
      [ticketId]
    );

    // Build invoice items
    const items: { descripcion: string; cantidad: number; precio_unitario: number }[] = [];

    for (const accion of accionesResult.rows) {
      items.push({
        descripcion: `${accion.accion_nombre || "Servicio"} - ${accion.horas_asignadas}h`,
        cantidad: accion.horas_asignadas,
        precio_unitario: accion.costo_hora,
      });
    }

    // If no acciones, use ticket data
    if (items.length === 0 && ticket.horas_reales && ticket.miembro_costo) {
      items.push({
        descripcion: ticket.titulo || `Ticket #${ticket.id}`,
        cantidad: ticket.horas_reales,
        precio_unitario: ticket.miembro_costo,
      });
    }

    // Calculate subtotal
    const subtotal = items.reduce(
      (sum, item) => sum + item.cantidad * item.precio_unitario,
      0
    );

    const result = await transaction(async (client) => {
      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO invoices (id_cliente, id_miembro, id_ticket, subtotal, impuestos, estado)
         VALUES ($1, $2, $3, $4, 0, 'pendiente')
         RETURNING *`,
        [ticket.id_cliente, ticket.id_miembro, ticketId, subtotal]
      );

      const invoice = invoiceResult.rows[0];

      // Create invoice items
      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items (id_invoice, descripcion, cantidad, precio_unitario)
           VALUES ($1, $2, $3, $4)`,
          [invoice.id, item.descripcion, item.cantidad, item.precio_unitario]
        );
      }

      return invoice;
    });

    return NextResponse.json({ invoice: result });
  } catch (error) {
    console.error("Error generating invoice from ticket:", error);
    return NextResponse.json({ error: "Error al generar la factura" }, { status: 500 });
  }
}
