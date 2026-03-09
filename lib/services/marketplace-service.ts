import { query, transaction } from "@/lib/db";
import type { Product, CartItem, Order, OrderWithItems } from "@/lib/types";

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
  // Prevent members from buying their own products
  const ownerCheck = await query(
    `SELECT mpi.member_id
     FROM products p
     JOIN member_portfolio_items mpi ON mpi.id = p.portfolio_item_id
     WHERE p.id = $1`,
    [productId]
  );
  if (ownerCheck.rows[0]?.member_id) {
    const userRes = await query("SELECT member_id FROM users WHERE id = $1", [userId]);
    if (userRes.rows[0]?.member_id === ownerCheck.rows[0].member_id) {
      throw new Error("No puedes comprar tus propios productos");
    }
  }

  // Check allow_quantities
  const prodRes = await query("SELECT allow_quantities FROM products WHERE id = $1", [productId]);
  const allowQty = prodRes.rows[0]?.allow_quantities ?? true;

  if (!allowQty) {
    // Check if already in cart
    const exists = await query(
      "SELECT id FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [userId, productId]
    );
    if (exists.rows.length > 0) {
      throw new Error("Este proyecto ya está en tu carrito");
    }
    quantity = 1;
  }

  const result = await query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = ${allowQty ? "cart_items.quantity + $3" : "1"}
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

  // Check allow_quantities via the linked product
  const prodRes = await query(
    `SELECT p.allow_quantities FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.id = $1 AND ci.user_id = $2`,
    [id, userId]
  );
  if (prodRes.rows[0] && !prodRes.rows[0].allow_quantities && quantity > 1) {
    throw new Error("Este proyecto no permite cantidades múltiples");
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

export async function addPortfolioItemToCart(userId: string, portfolioItemId: number) {
  // Prevent members from buying their own portfolio items
  const ownerCheck = await query(
    "SELECT member_id FROM member_portfolio_items WHERE id = $1",
    [portfolioItemId]
  );
  if (ownerCheck.rows[0]?.member_id) {
    const userRes = await query("SELECT member_id FROM users WHERE id = $1", [userId]);
    if (userRes.rows[0]?.member_id === ownerCheck.rows[0].member_id) {
      throw new Error("No puedes comprar tus propios proyectos");
    }
  }

  // Find or create a linked product for this portfolio item
  const existing = await query(
    "SELECT id FROM products WHERE portfolio_item_id = $1",
    [portfolioItemId]
  );

  let productId: number;

  if (existing.rows.length > 0) {
    productId = existing.rows[0].id;
    // Sync price/name/allow_quantities from portfolio item
    await query(
      `UPDATE products SET
         name = p.title,
         description = p.description,
         price = COALESCE(p.cost, 0),
         image_url = p.image_url,
         is_active = true,
         allow_quantities = p.allow_quantities,
         stock = GREATEST(products.stock, 1)
       FROM member_portfolio_items p
       WHERE products.id = $1 AND p.id = $2`,
      [productId, portfolioItemId]
    );
  } else {
    // Create product from portfolio item
    const piRes = await query(
      "SELECT title, description, image_url, cost, allow_quantities FROM member_portfolio_items WHERE id = $1",
      [portfolioItemId]
    );
    if (piRes.rows.length === 0) throw new Error("Portfolio item not found");
    const pi = piRes.rows[0];
    if (!pi.cost) throw new Error("Este proyecto no tiene precio definido");

    const insertRes = await query(
      `INSERT INTO products (name, description, price, image_url, stock, category, allow_quantities, portfolio_item_id)
       VALUES ($1, $2, $3, $4, 999, 'proyecto', $5, $6)
       RETURNING id`,
      [pi.title, pi.description, pi.cost, pi.image_url, pi.allow_quantities, portfolioItemId]
    );
    productId = insertRes.rows[0].id;
  }

  return addToCart(userId, productId);
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
    // Get cart items with portfolio info to detect member-owned items
    const cartRes = await client.query(
      `SELECT ci.*, p.price, p.name, p.stock, p.portfolio_item_id,
              mpi.member_id
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN member_portfolio_items mpi ON mpi.id = p.portfolio_item_id
       WHERE ci.user_id = $1`,
      [userId]
    );

    if (cartRes.rows.length === 0) {
      throw new Error("Cart is empty");
    }

    // Calculate total and check stock
    let total = 0;
    let hasConfirmationItems = false;
    for (const item of cartRes.rows) {
      if (item.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}`);
      }
      total += item.price * item.quantity;
      if (item.portfolio_item_id && item.member_id) {
        hasConfirmationItems = true;
      }
    }

    // Create order — status depends on whether confirmation is needed
    const initialStatus = hasConfirmationItems ? "pending_confirmation" : "pending";
    const orderRes = await client.query(
      "INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *",
      [userId, total, initialStatus]
    );
    const order = orderRes.rows[0];

    // Create order items and decrement stock
    for (const item of cartRes.rows) {
      const requiresConfirmation = !!(item.portfolio_item_id && item.member_id);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, member_id, requires_confirmation)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.product_id, item.quantity, item.price, item.member_id || null, requiresConfirmation]
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

export async function getOrderWithItems(id: number): Promise<OrderWithItems | null> {
  const orderRes = await query(
    `SELECT o.*,
            COALESCE(u.first_name || ' ' || u.last_name, u.email) AS user_name,
            u.email AS user_email
     FROM orders o
     JOIN users u ON u.id = o.user_id
     WHERE o.id = $1`,
    [id]
  );
  if (!orderRes.rows[0]) return null;

  const itemsRes = await query(
    `SELECT oi.*, p.name AS product_name, p.image_url,
            m.name AS member_name, m.email AS member_email
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN members m ON m.id = oi.member_id
     WHERE oi.order_id = $1`,
    [id]
  );

  return { ...orderRes.rows[0], items: itemsRes.rows };
}

// ----- Confirmation flow -----

export async function getOrderMemberContacts(orderId: number) {
  const result = await query(
    `SELECT DISTINCT m.id, m.name, m.email
     FROM order_items oi
     JOIN members m ON m.id = oi.member_id
     WHERE oi.order_id = $1 AND oi.requires_confirmation = true`,
    [orderId]
  );
  return result.rows as { id: number; name: string; email: string | null }[];
}

export async function memberRespondToOrder(
  orderId: number,
  memberId: number,
  data: { confirmed: boolean; delivery_date?: string; message?: string }
) {
  // Update all items for this member in this order
  await query(
    `UPDATE order_items
     SET member_confirmed = $1,
         delivery_date = $2,
         member_message = $3,
         member_responded_at = NOW()
     WHERE order_id = $4 AND member_id = $5 AND requires_confirmation = true`,
    [data.confirmed, data.delivery_date || null, data.message || null, orderId, memberId]
  );

  // Check if all confirmation items have been responded to
  const pendingRes = await query(
    `SELECT COUNT(*) FROM order_items
     WHERE order_id = $1 AND requires_confirmation = true AND member_confirmed IS NULL`,
    [orderId]
  );
  const allResponded = parseInt(pendingRes.rows[0].count, 10) === 0;

  if (allResponded) {
    // Check if any member rejected
    const rejectedRes = await query(
      `SELECT COUNT(*) FROM order_items
       WHERE order_id = $1 AND requires_confirmation = true AND member_confirmed = false`,
      [orderId]
    );
    const hasRejection = parseInt(rejectedRes.rows[0].count, 10) > 0;

    if (hasRejection) {
      // If any member rejected, cancel the order
      await query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);
    } else {
      // All confirmed → awaiting client acceptance
      await query("UPDATE orders SET status = 'awaiting_acceptance' WHERE id = $1", [orderId]);
    }
  }

  return getOrderWithItems(orderId);
}

export async function clientRespondToOrder(
  orderId: number,
  userId: string,
  accepted: boolean
) {
  // Verify the order belongs to this user
  const orderRes = await query(
    "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
    [orderId, userId]
  );
  if (!orderRes.rows[0]) throw new Error("Order not found");
  if (orderRes.rows[0].status !== "awaiting_acceptance") {
    throw new Error("Order is not awaiting acceptance");
  }

  // Update all confirmation items
  await query(
    `UPDATE order_items
     SET client_accepted = $1, client_responded_at = NOW()
     WHERE order_id = $2 AND requires_confirmation = true`,
    [accepted, orderId]
  );

  // Update order status
  const newStatus = accepted ? "awaiting_payment" : "cancelled";
  await query("UPDATE orders SET status = $1 WHERE id = $2", [newStatus, orderId]);

  return getOrderWithItems(orderId);
}

export async function listPendingConfirmationsForMember(memberId: number): Promise<OrderWithItems[]> {
  // Find all orders that have items pending confirmation for this member
  const orderIds = await query(
    `SELECT DISTINCT oi.order_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.member_id = $1
       AND oi.requires_confirmation = true
       AND oi.member_confirmed IS NULL
       AND o.status = 'pending_confirmation'
     ORDER BY oi.order_id DESC`,
    [memberId]
  );

  const orders: OrderWithItems[] = [];
  for (const row of orderIds.rows) {
    const order = await getOrderWithItems(row.order_id);
    if (order) orders.push(order);
  }
  return orders;
}
