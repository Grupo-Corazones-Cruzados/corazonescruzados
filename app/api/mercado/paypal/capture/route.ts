import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import { capturePayPalOrder } from "@/lib/paypal";

// POST - Capture PayPal payment after approval
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, paypalOrderId } = body;

    if (!orderId || !paypalOrderId) {
      return NextResponse.json(
        { error: "orderId y paypalOrderId son requeridos" },
        { status: 400 }
      );
    }

    // Verify order belongs to user and has matching PayPal order ID
    const orderResult = await query(
      `SELECT id, estado, paypal_order_id
      FROM orders
      WHERE id = $1 AND id_comprador = $2`,
      [orderId, tokenData.userId]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const order = orderResult.rows[0];

    if (order.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Este pedido ya no está pendiente" },
        { status: 400 }
      );
    }

    if (order.paypal_order_id !== paypalOrderId) {
      return NextResponse.json(
        { error: "PayPal order ID no coincide" },
        { status: 400 }
      );
    }

    // Capture the PayPal payment
    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `El pago no fue completado. Estado: ${capture.status}` },
        { status: 400 }
      );
    }

    // Update order status
    await query(
      `UPDATE orders
      SET estado = 'pagado', paypal_capture_id = $1
      WHERE id = $2`,
      [capture.captureId, orderId]
    );

    return NextResponse.json({
      success: true,
      captureId: capture.captureId,
      status: capture.status,
      payerEmail: capture.payerEmail,
    });
  } catch (error: any) {
    console.error("Error capturing PayPal payment:", error);
    return NextResponse.json(
      { error: error.message || "Error al capturar pago de PayPal" },
      { status: 500 }
    );
  }
}
