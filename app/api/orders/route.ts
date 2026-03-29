import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { rows } = await pool.query(
      `SELECT o.*,
        (SELECT json_agg(json_build_object(
          'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity,
          'unit_price', oi.unit_price, 'subtotal', oi.subtotal,
          'member_confirmed', oi.member_confirmed, 'member_message', oi.member_message,
          'delivery_date', oi.delivery_date, 'client_accepted', oi.client_accepted,
          'product_title', p.title, 'member_name', m.name
        ))
        FROM gcc_world.order_items oi
        LEFT JOIN gcc_world.member_portfolio_items p ON p.id = oi.product_id
        LEFT JOIN gcc_world.members m ON m.id = oi.member_id
        WHERE oi.order_id = o.id) as items
       FROM gcc_world.orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [user.userId]
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Orders error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const { product_id, quantity = 1 } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'Producto requerido' }, { status: 400 });
    }

    // Fetch the product to validate it exists and get price/member
    const productRes = await pool.query(
      `SELECT id, title, cost, member_id, allow_quantities, item_type
       FROM gcc_world.member_portfolio_items WHERE id = $1`,
      [product_id]
    );

    if (productRes.rows.length === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const product = productRes.rows[0];
    const unitPrice = Number(product.cost) || 0;

    if (unitPrice <= 0) {
      return NextResponse.json({ error: 'Este producto no tiene precio definido' }, { status: 400 });
    }

    const qty = product.allow_quantities ? Math.max(1, Math.floor(Number(quantity))) : 1;
    const subtotal = unitPrice * qty;

    // Check the buyer is not the same member who owns the product
    if (user.role === 'member') {
      const memberRes = await pool.query(
        `SELECT id FROM gcc_world.members WHERE user_id = $1`,
        [user.userId]
      );
      if (memberRes.rows.length > 0 && memberRes.rows[0].id === product.member_id) {
        return NextResponse.json({ error: 'No puedes comprar tu propio producto' }, { status: 400 });
      }
    }

    // Create order and order item in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderRes = await client.query(
        `INSERT INTO gcc_world.orders (user_id, total, status, created_at, updated_at)
         VALUES ($1, $2, 'pending', NOW(), NOW()) RETURNING *`,
        [user.userId, subtotal]
      );

      const order = orderRes.rows[0];

      await client.query(
        `INSERT INTO gcc_world.order_items (order_id, product_id, quantity, unit_price, subtotal, member_id, requires_confirmation)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [order.id, product.id, qty, unitPrice, subtotal, product.member_id]
      );

      await client.query('COMMIT');

      return NextResponse.json({ data: order }, { status: 201 });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Order create error:', err.message);
    return NextResponse.json({ error: 'Error al crear pedido' }, { status: 500 });
  }
}
