import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "unknown";
}

// POST /api/public-tickets - Create a ticket from public form (1 per IP without account)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clienteNombre,
      clienteApellido,
      clienteContacto,
      clienteCorreo,
      detalle,
      id_miembro,
      id_accion,
    } = body;

    if (!clienteCorreo || !id_miembro || !id_accion) {
      return NextResponse.json(
        { error: "Correo, miembro y acción son requeridos" },
        { status: 400 }
      );
    }

    const clientIp = getClientIP(request);

    // Check if this IP already has a public ticket
    if (clientIp !== "unknown") {
      const existingTicket = await query(
        "SELECT id FROM tickets WHERE ip_address = $1 LIMIT 1",
        [clientIp]
      );

      if (existingTicket.rows.length > 0) {
        // IP already used — check if user has a registered account
        const hasAccount = await query(
          "SELECT id FROM user_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1",
          [clienteCorreo]
        );

        if (hasAccount.rows.length === 0) {
          return NextResponse.json(
            {
              error: "Ya has creado un ticket. Para generar más, crea una cuenta primero.",
              code: "ACCOUNT_REQUIRED",
            },
            { status: 403 }
          );
        }
      }
    }

    // Check if client exists
    const existingClient = await query(
      "SELECT id FROM clientes WHERE correo_electronico = $1",
      [clienteCorreo.toLowerCase()]
    );

    let clienteId: number;

    if (existingClient.rows.length === 0) {
      // Create new client
      const newClient = await query(
        `INSERT INTO clientes (nombre, contacto, correo_electronico)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [`${clienteNombre} ${clienteApellido}`, clienteContacto, clienteCorreo.toLowerCase()]
      );
      clienteId = newClient.rows[0].id;
    } else {
      clienteId = existingClient.rows[0].id;
    }

    // Create ticket with IP
    await query(
      `INSERT INTO tickets (id_cliente, id_accion, id_miembro, detalle, estado, ip_address)
       VALUES ($1, $2, $3, $4, 'pendiente', $5)`,
      [clienteId, id_accion, id_miembro, detalle, clientIp !== "unknown" ? clientIp : null]
    );

    // Get member's phone number
    const miembroResult = await query(
      "SELECT celular, nombre FROM miembros WHERE id = $1",
      [id_miembro]
    );

    const miembro = miembroResult.rows[0];

    return NextResponse.json({
      success: true,
      miembro: {
        celular: miembro?.celular,
        nombre: miembro?.nombre,
      },
    });
  } catch (error) {
    console.error("Error creating public ticket:", error);
    return NextResponse.json({ error: "Error al crear el ticket" }, { status: 500 });
  }
}
