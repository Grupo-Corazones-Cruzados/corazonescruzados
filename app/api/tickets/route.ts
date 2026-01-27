import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/tickets - List tickets with role-based filtering
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const estado = searchParams.get("estado") || "";
    const miembroFilter = searchParams.get("miembro");
    const view = searchParams.get("view") || "";
    const clienteFilter = searchParams.get("cliente");

    // Get user profile to check role
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { rol, id_miembro } = userResult.rows[0];

    let sql = `
      SELECT
        t.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto, 'puesto', m.puesto, 'costo', m.costo) as miembro,
        json_build_object('id', a.id, 'nombre', a.nombre) as accion
      FROM tickets t
      LEFT JOIN clientes c ON t.id_cliente = c.id
      LEFT JOIN miembros m ON t.id_miembro = m.id
      LEFT JOIN acciones a ON t.id_accion = a.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (rol === "miembro" && id_miembro) {
      if (view === "created") {
        // Member wants to see tickets they created as a client
        const clientResult = await query(
          "SELECT id FROM clientes WHERE correo_electronico = $1",
          [tokenData.email]
        );
        if (clientResult.rows.length > 0) {
          sql += ` AND t.id_cliente = $${paramIndex}`;
          params.push(clientResult.rows[0].id);
          paramIndex++;
        } else {
          return NextResponse.json({ tickets: [], stats: { total: 0, pendientes: 0, enProgreso: 0, completados: 0 } });
        }
      } else {
        // Normal view: tickets assigned to the member
        sql += ` AND t.id_miembro = $${paramIndex}`;
        params.push(id_miembro);
        paramIndex++;
      }
    } else if (rol === "cliente") {
      // Get client ID from email
      const clientResult = await query(
        "SELECT id FROM clientes WHERE correo_electronico = $1",
        [tokenData.email]
      );
      if (clientResult.rows.length > 0) {
        sql += ` AND t.id_cliente = $${paramIndex}`;
        params.push(clientResult.rows[0].id);
        paramIndex++;
      } else {
        return NextResponse.json({ tickets: [], stats: { total: 0, pendientes: 0, enProgreso: 0, completados: 0 } });
      }
    }

    // Apply filters
    if (search) {
      sql += ` AND (t.titulo ILIKE $${paramIndex} OR t.detalle ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (estado && estado !== "todos") {
      sql += ` AND t.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    if (miembroFilter) {
      sql += ` AND t.id_miembro = $${paramIndex}`;
      params.push(parseInt(miembroFilter));
      paramIndex++;
    }

    if (clienteFilter) {
      sql += ` AND t.id_cliente = $${paramIndex}`;
      params.push(parseInt(clienteFilter));
      paramIndex++;
    }

    sql += " ORDER BY t.created_at DESC";

    const result = await query(sql, params);
    const tickets = result.rows;

    // Calculate stats
    const stats = {
      total: tickets.length,
      pendientes: tickets.filter((t) => t.estado === "pendiente").length,
      enProgreso: tickets.filter((t) => t.estado === "en_progreso" || t.estado === "confirmado").length,
      completados: tickets.filter((t) => t.estado === "completado").length,
    };

    return NextResponse.json({ tickets, stats });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "Error al cargar los tickets" }, { status: 500 });
  }
}

// POST /api/tickets - Create a new ticket
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id_cliente,
      id_miembro,
      titulo,
      detalle,
      horas_estimadas,
      costo_estimado,
      fecha_programada,
      slots,
      acciones,
    } = body;

    if (!id_cliente || !id_miembro || !titulo) {
      return NextResponse.json(
        { error: "Cliente, miembro y título son requeridos" },
        { status: 400 }
      );
    }

    const result = await transaction(async (client) => {
      // Create ticket
      const ticketResult = await client.query(
        `INSERT INTO tickets (id_cliente, id_miembro, titulo, detalle, horas_estimadas, costo_estimado, fecha_programada, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
         RETURNING *`,
        [id_cliente, id_miembro, titulo, detalle, horas_estimadas, costo_estimado, fecha_programada]
      );

      const ticket = ticketResult.rows[0];

      // Create slots
      if (slots && slots.length > 0) {
        for (const slot of slots) {
          await client.query(
            `INSERT INTO ticket_slots (id_ticket, fecha, hora_inicio, hora_fin, estado)
             VALUES ($1, $2, $3, $4, 'pendiente')`,
            [ticket.id, slot.fecha, slot.hora_inicio, slot.hora_fin]
          );
        }
      }

      // Create acciones
      if (acciones && acciones.length > 0) {
        for (const accion of acciones) {
          await client.query(
            `INSERT INTO ticket_acciones (id_ticket, id_accion, horas_asignadas, costo_hora)
             VALUES ($1, $2, $3, $4)`,
            [ticket.id, accion.id_accion, accion.horas_asignadas, accion.costo_hora]
          );
        }
      }

      return ticket;
    });

    return NextResponse.json({ ticket: result });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json({ error: "Error al crear el ticket" }, { status: 500 });
  }
}
