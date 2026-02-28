import { query, transaction } from "@/lib/db";
import type { Product, CartItem, Order } from "@/lib/types";

// ----- Products -----

export async function listProducts(params: {
  active_only?: boolean;
  category?: string;
  search?: string;
}): Promise<Product[]> {
  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.active_only !== false) {
    conds.push(`is_active = true`);
  }
  if (params.category) {
    conds.push(`category = $${idx++}`);
    vals.push(params.category);
  }
  if (params.search) {
    conds.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
    vals.push(`%${params.search}%`);
    idx++;
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM products ${where} ORDER BY name`, vals);
  return result.rows;
}

export async function getProductById(id: number): Promise<Product | null> {
  const result = await query("SELECT * FROM products WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  stock?: number;
}): Promise<Product> {
  const result = await query(
    `INSERT INTO products (name, description, price, image_url, category, stock)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.name,
      data.description || null,
      data.price,
      data.image_url || null,
      data.category || null,
      data.stock ?? 0,
    ]
  );
  return result.rows[0];
}

export async function updateProduct(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    image_url: string;
    category: string;
    stock: number;
    is_active: boolean;
  }>
): Promise<Product | null> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      vals.push(value);
    }
  }
  if (fields.length === 0) return getProductById(id);

  vals.push(id);
  const result = await query(
    `UPDATE products SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

// ----- Cart -----

export async function getCart(userId: string): Promise<(CartItem & { product: Product })[]> {
  const result = await query(
    `SELECT ci.*, row_to_json(p) AS product
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = $1
     ORDER BY ci.created_at`,
    [userId]
  );
  return result.rows;
}

export async function addToCart(userId: string, productId: number, quantity = 1) {
  const result = await query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + $3
     RETURNING *`,
    [userId, productId, quantity]
  );
  return result.rows[0];
}

export async function updateCartItem(id: number, userId: string, quantity: number) {
  if (quantity <= 0) {
    await query("DELETE FROM cart_items WHERE id = $1 AND user_id = $2", [id, userId]);
    return null;
  }
  const result = await query(
    "UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
    [quantity, id, userId]
  );
  return result.rows[0] || null;
}

export async function clearCart(userId: string) {
  await query("DELETE FROM cart_items WHERE user_id = $1", [userId]);
}

// ----- Orders -----

export async function listOrders(params: {
  user_id?: string;
  page?: number;
  per_page?: number;
}) {
  const page = params.page || 1;
  const perPage = params.per_page || 20;
  const offset = (page - 1) * perPage;

  const conds: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (params.user_id) {
    conds.push(`o.user_id = $${idx++}`);
    vals.push(params.user_id);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";

  const countRes = await query(`SELECT COUNT(*) FROM orders o ${where}`, vals);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataVals = [...vals, perPage, offset];
  const result = await query(
    `SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    dataVals
  );

  return {
    data: result.rows,
    total,
    page,
    per_page: perPage,
    total_pages: Math.ceil(total / perPage),
  };
}

export async function createOrderFromCart(userId: string): Promise<Order> {
  return transaction(async (client) => {
    // Get cart items
    const cartRes = await client.query(
      `SELECT ci.*, p.price, p.name, p.stock
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1`,
      [userId]
    );

    if (cartRes.rows.length === 0) {
      throw new Error("Cart is empty");
    }

    // Calculate total and check stock
    let total = 0;
    for (const item of cartRes.rows) {
      if (item.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
      total += item.price * item.quantity;
    }

    // Create order
    const orderRes = await client.query(
      "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING *",
      [userId, total]
    );
    const order = orderRes.rows[0];

    // Create order items and decrement stock
    for (const item of cartRes.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
      await client.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }

    // Clear cart
    await client.query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

    return order;
  });
}

export async function updateOrderStatus(
  id: number,
  status: string,
  paypalData?: { paypal_order_id?: string; paypal_capture_id?: string }
) {
  const fields = ["status = $1"];
  const vals: unknown[] = [status];
  let idx = 2;

  if (paypalData?.paypal_order_id) {
    fields.push(`paypal_order_id = $${idx++}`);
    vals.push(paypalData.paypal_order_id);
  }
  if (paypalData?.paypal_capture_id) {
    fields.push(`paypal_capture_id = $${idx++}`);
    vals.push(paypalData.paypal_capture_id);
  }

  vals.push(id);
  const result = await query(
    `UPDATE orders SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}

export async function getOrderWithItems(id: number) {
  const orderRes = await query("SELECT * FROM orders WHERE id = $1", [id]);
  if (!orderRes.rows[0]) return null;

  const itemsRes = await query(
    `SELECT oi.*, p.name AS product_name, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1`,
    [id]
  );

  return { ...orderRes.rows[0], items: itemsRes.rows };
}
