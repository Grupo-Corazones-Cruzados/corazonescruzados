import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// POST /api/paquetes/solicitud - Create a package request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paqueteId, miembroId, nombre, apellido, correo, telefono } = body;

    if (!paqueteId || !miembroId || !nombre || !correo || !telefono) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Get or create client
    const existingClient = await query(
      "SELECT id FROM clientes WHERE correo_electronico = $1",
      [correo]
    );

    let clienteId: number;

    if (existingClient.rows.length > 0) {
      clienteId = existingClient.rows[0].id;
    } else {
      // Create new client
      const newClient = await query(
        `INSERT INTO clientes (nombre, contacto, correo_electronico, id_miembro)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [`${nombre} ${apellido}`.trim(), telefono, correo, miembroId]
      );
      clienteId = newClient.rows[0].id;

      // Trigger Power Automate webhook (optional, don't fail if it fails)
      try {
        await fetch(
          "https://ecc5f0d6fde7ef24ade927ef544fe2.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ad41a7f54b1c4c2f9cc987193a8b5496/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=KzX_ss8H8PkgEBKXqBA2R_Up8CFesQrJ08MSs6fwiXM",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre,
              apellido,
              correo,
              contacto: telefono,
            }),
          }
        );
      } catch (err) {
        console.warn("Power Automate webhook falló (continuando):", err);
      }
    }

    // Create tickets_paquetes record
    await query(
      `INSERT INTO tickets_paquetes (id_paquete, id_miembro, id_cliente)
       VALUES ($1, $2, $3)`,
      [paqueteId, miembroId, clienteId]
    );

    return NextResponse.json({ success: true, clienteId });
  } catch (error) {
    console.error("Error creating package request:", error);
    return NextResponse.json(
      { error: "Error al crear la solicitud" },
      { status: 500 }
    );
  }
}
