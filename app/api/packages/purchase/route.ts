import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import {
  sendPackagePurchaseConfirmation,
  sendPackageRequestToMember,
} from "@/lib/email";

// POST /api/packages/purchase - Client purchases a package from a member
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { id_miembro, id_paquete, notas } = body;

    if (!id_miembro || !id_paquete) {
      return NextResponse.json(
        { error: "Miembro y paquete son requeridos" },
        { status: 400 }
      );
    }

    // Get client user profile
    const userResult = await query(
      "SELECT id, nombre, apellido, email FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const clienteData = userResult.rows[0];
    const cliente = {
      id: clienteData.id,
      nombre: clienteData.nombre ? `${clienteData.nombre} ${clienteData.apellido || ''}`.trim() : clienteData.email,
      correo_electronico: clienteData.email,
    };

    // Get member info
    const memberResult = await query(
      `SELECT m.id, m.nombre, m.foto, m.correo as correo_electronico
       FROM miembros m
       WHERE m.id = $1`,
      [id_miembro]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Miembro no encontrado" },
        { status: 404 }
      );
    }

    const miembro = memberResult.rows[0];

    // Get package info
    const packageResult = await query(
      "SELECT id, nombre, horas, descripcion FROM paquetes WHERE id = $1",
      [id_paquete]
    );

    if (packageResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    const paquete = packageResult.rows[0];

    // Create purchase record
    const purchaseResult = await query(
      `INSERT INTO package_purchases
       (id_cliente, id_miembro, id_paquete, horas_totales, notas_cliente, estado)
       VALUES ($1, $2, $3, $4, $5, 'pendiente')
       RETURNING *`,
      [tokenData.userId, id_miembro, id_paquete, paquete.horas, notas || null]
    );

    const purchase = purchaseResult.rows[0];

    // Send confirmation email to client
    await sendPackagePurchaseConfirmation(
      cliente.correo_electronico,
      cliente.nombre,
      {
        id: purchase.id,
        nombre: paquete.nombre,
        horas: paquete.horas,
        descripcion: paquete.descripcion,
      },
      miembro.nombre
    );

    // Send notification email to member
    await sendPackageRequestToMember(
      miembro.correo_electronico,
      miembro.nombre,
      {
        id: purchase.id,
        nombre: paquete.nombre,
        horas: paquete.horas,
      },
      cliente.nombre,
      notas
    );

    return NextResponse.json({
      success: true,
      purchase: {
        ...purchase,
        paquete,
        miembro: {
          id: miembro.id,
          nombre: miembro.nombre,
          foto: miembro.foto,
        },
      },
    });
  } catch (error) {
    console.error("Error creating package purchase:", error);
    return NextResponse.json(
      { error: "Error al crear la compra del paquete" },
      { status: 500 }
    );
  }
}
