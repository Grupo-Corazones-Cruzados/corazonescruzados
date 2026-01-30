import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";
import { createPayPalOrder } from "@/lib/paypal";

// POST - Create PayPal order for checkout
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId es requerido" }, { status: 400 });
    }

    // Get order with items
    const orderResult = await query(
      `SELECT
        o.id, o.total, o.estado, o.id_comprador
      FROM orders o
      WHERE o.id = $1 AND o.id_comprador = $2`,
      [orderId, tokenData.userId]
    );

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const order = orderResult.rows[0];

    if (order.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Este pedido no está pendiente de pago" },
        { status: 400 }
      );
    }

    // Get order items
    const itemsResult = await query(
      `SELECT
        oi.cantidad, oi.precio_unitario,
        p.nombre
      FROM order_items oi
      JOIN productos p ON oi.id_producto = p.id
      WHERE oi.id_order = $1`,
      [orderId]
    );

    if (itemsResult.rows.length === 0) {
      return NextResponse.json({ error: "El pedido no tiene productos" }, { status: 400 });
    }

    // Prepare items for PayPal
    const items = itemsResult.rows.map((item) => ({
      name: item.nombre || "Producto",
      quantity: item.cantidad,
      unitPrice: parseFloat(item.precio_unitario),
    }));

    // Get base URL for return/cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${baseUrl}/dashboard/mercado/pedidos?paypal=success&orderId=${orderId}`;
    const cancelUrl = `${baseUrl}/dashboard/mercado/pedidos?paypal=cancel&orderId=${orderId}`;

    // Create PayPal order
    const paypalOrder = await createPayPalOrder({
      orderId: order.id,
      total: parseFloat(order.total),
      items,
      returnUrl,
      cancelUrl,
    });

    // Save PayPal order ID to our order
    await query(
      "UPDATE orders SET paypal_order_id = $1 WHERE id = $2",
      [paypalOrder.paypalOrderId, orderId]
    );

    return NextResponse.json({
      paypalOrderId: paypalOrder.paypalOrderId,
      approvalUrl: paypalOrder.approvalUrl,
    });
  } catch (error: any) {
    console.error("Error creating PayPal order:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear orden de PayPal" },
      { status: 500 }
    );
  }
}
