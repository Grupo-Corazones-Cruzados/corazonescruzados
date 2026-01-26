import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// POST /api/public-tickets - Create a ticket from public form
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

    // Check if client exists
    const existingClient = await query(
      "SELECT id FROM clientes WHERE correo_electronico = $1",
      [clienteCorreo.toLowerCase()]
    );

    let clienteId: number;

    if (existingClient.rows.length === 0) {
      // Create new client
      const newClient = await query(
        `INSERT INTO clientes (nombre, telefono, correo_electronico)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [`${clienteNombre} ${clienteApellido}`, clienteContacto, clienteCorreo.toLowerCase()]
      );
      clienteId = newClient.rows[0].id;
    } else {
      clienteId = existingClient.rows[0].id;
    }

    // Create ticket
    await query(
      `INSERT INTO tickets (id_cliente, id_accion, id_miembro, detalle, estado)
       VALUES ($1, $2, $3, $4, 'pendiente')`,
      [clienteId, id_accion, id_miembro, detalle]
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
