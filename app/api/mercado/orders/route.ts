import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query, transaction } from "@/lib/db";

// Check if orders table exists
let ordersTableExists: boolean | null = null;

async function checkOrdersTable(): Promise<boolean> {
  if (ordersTableExists !== null) return ordersTableExists;
  try {
    await query("SELECT 1 FROM orders LIMIT 0");
    ordersTableExists = true;
  } catch {
    ordersTableExists = false;
  }
  return ordersTableExists;
}

// GET - Get user's orders
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const hasOrdersTable = await checkOrdersTable();
    if (!hasOrdersTable) {
      return NextResponse.json({ orders: [], message: "Orders not available - run migrations" });
    }

    // Get orders
    const ordersResult = await query(
      `SELECT
        id, id_comprador, estado, total, notas,
        paypal_order_id, paypal_capture_id, created_at, updated_at
      FROM orders
      WHERE id_comprador = $1
      ORDER BY created_at DESC`,
      [tokenData.userId]
    );

    // Get order items for each order
    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const itemsResult = await query(
          `SELECT
            oi.id, oi.id_order, oi.id_producto, oi.cantidad, oi.precio_unitario, oi.subtotal,
            p.nombre as producto_nombre,
            p.imagen as producto_imagen,
            p.imagenes as producto_imagenes,
            m.nombre as vendedor_nombre
          FROM order_items oi
          JOIN productos p ON oi.id_producto = p.id
          LEFT JOIN miembros m ON p.id_miembro = m.id
          WHERE oi.id_order = $1`,
          [order.id]
        );

        const items = itemsResult.rows.map((item) => ({
          id: item.id,
          id_order: item.id_order,
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: parseFloat(item.precio_unitario),
          subtotal: parseFloat(item.subtotal),
          producto: {
            id: item.id_producto,
            nombre: item.producto_nombre,
            imagen: item.producto_imagen,
            imagenes: item.producto_imagenes || [],
            vendedor_nombre: item.vendedor_nombre,
          },
        }));

        return {
          ...order,
          total: parseFloat(order.total),
          items,
        };
      })
    );

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Error al cargar los pedidos" }, { status: 500 });
  }
}

// POST - Create order from cart
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const hasOrdersTable = await checkOrdersTable();
    if (!hasOrdersTable) {
      return NextResponse.json({ error: "Pedidos no disponible - ejecute las migraciones" }, { status: 503 });
    }

    const body = await request.json();
    const { notas } = body;

    // Use transaction to create order atomically
    const order = await transaction(async (client) => {
      // Get cart items
      const cartResult = await client.query(
        `SELECT
          ci.id, ci.id_producto, ci.cantidad,
          p.costo, p.nombre, p.activo
        FROM cart_items ci
        JOIN productos p ON ci.id_producto = p.id
        WHERE ci.id_usuario = $1`,
        [tokenData.userId]
      );

      if (cartResult.rows.length === 0) {
        throw new Error("El carrito está vacío");
      }

      // Verify all products are available
      const unavailable = cartResult.rows.filter((item) => !item.activo);
      if (unavailable.length > 0) {
        throw new Error(`Algunos productos no están disponibles: ${unavailable.map((u) => u.nombre).join(", ")}`);
      }

      // Calculate total
      const total = cartResult.rows.reduce((sum, item) => {
        return sum + (item.costo || 0) * item.cantidad;
      }, 0);

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (id_comprador, estado, total, notas)
        VALUES ($1, 'pendiente', $2, $3)
        RETURNING *`,
        [tokenData.userId, total, notas || null]
      );

      const orderId = orderResult.rows[0].id;

      // Create order items
      for (const item of cartResult.rows) {
        const subtotal = (item.costo || 0) * item.cantidad;
        await client.query(
          `INSERT INTO order_items (id_order, id_producto, cantidad, precio_unitario, subtotal)
          VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.id_producto, item.cantidad, item.costo || 0, subtotal]
        );
      }

      // Clear cart
      await client.query(
        "DELETE FROM cart_items WHERE id_usuario = $1",
        [tokenData.userId]
      );

      return {
        ...orderResult.rows[0],
        total: parseFloat(orderResult.rows[0].total),
      };
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error.message || "Error al crear el pedido" },
      { status: 500 }
    );
  }
}

// PATCH - Update order status (for PayPal integration)
export async function PATCH(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const hasOrdersTable = await checkOrdersTable();
    if (!hasOrdersTable) {
      return NextResponse.json({ error: "Pedidos no disponible - ejecute las migraciones" }, { status: 503 });
    }

    const body = await request.json();
    const { id, estado, paypal_order_id, paypal_capture_id } = body;

    if (!id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    // Verify ownership
    const orderResult = await query(
      "SELECT id FROM orders WHERE id = $1 AND id_comprador = $2",
      [id, tokenData.userId]
    );
    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (estado) {
      updates.push(`estado = $${paramIndex++}`);
      params.push(estado);
    }
    if (paypal_order_id) {
      updates.push(`paypal_order_id = $${paramIndex++}`);
      params.push(paypal_order_id);
    }
    if (paypal_capture_id) {
      updates.push(`paypal_capture_id = $${paramIndex++}`);
      params.push(paypal_capture_id);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    params.push(id);

    const result = await query(
      `UPDATE orders SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    return NextResponse.json({
      order: {
        ...result.rows[0],
        total: parseFloat(result.rows[0].total),
      },
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Error al actualizar el pedido" }, { status: 500 });
  }
}
