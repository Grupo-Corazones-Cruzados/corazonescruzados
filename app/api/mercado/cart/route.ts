import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";

// Check if cart_items table exists
let cartTableExists: boolean | null = null;

async function checkCartTable(): Promise<boolean> {
  if (cartTableExists !== null) return cartTableExists;
  try {
    await query("SELECT 1 FROM cart_items LIMIT 0");
    cartTableExists = true;
  } catch {
    cartTableExists = false;
  }
  return cartTableExists;
}

// GET - Get cart items
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Check if cart table exists
    const hasCartTable = await checkCartTable();
    if (!hasCartTable) {
      return NextResponse.json({ items: [], message: "Cart not available - run migrations" });
    }

    const result = await query(
      `SELECT
        ci.id, ci.id_usuario, ci.id_producto, ci.cantidad, ci.created_at,
        p.nombre as producto_nombre,
        p.descripcion as producto_descripcion,
        p.imagen as producto_imagen,
        p.imagenes as producto_imagenes,
        p.costo as producto_costo,
        p.categoria as producto_categoria,
        m.nombre as vendedor_nombre,
        m.foto as vendedor_foto
      FROM cart_items ci
      JOIN productos p ON ci.id_producto = p.id
      LEFT JOIN miembros m ON p.id_miembro = m.id
      WHERE ci.id_usuario = $1
      ORDER BY ci.created_at DESC`,
      [tokenData.userId]
    );

    // Transform to nested structure
    const items = result.rows.map((row) => ({
      id: row.id,
      id_usuario: row.id_usuario,
      id_producto: row.id_producto,
      cantidad: row.cantidad,
      created_at: row.created_at,
      producto: {
        id: row.id_producto,
        nombre: row.producto_nombre,
        descripcion: row.producto_descripcion,
        imagen: row.producto_imagen,
        imagenes: row.producto_imagenes || [],
        costo: row.producto_costo,
        categoria: row.producto_categoria,
        vendedor_nombre: row.vendedor_nombre,
        vendedor_foto: row.vendedor_foto,
      },
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return NextResponse.json({ error: "Error al cargar el carrito" }, { status: 500 });
  }
}

// POST - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const hasCartTable = await checkCartTable();
    if (!hasCartTable) {
      return NextResponse.json({ error: "Carrito no disponible - ejecute las migraciones" }, { status: 503 });
    }

    const body = await request.json();
    const { id_producto, cantidad = 1 } = body;

    if (!id_producto) {
      return NextResponse.json({ error: "id_producto es requerido" }, { status: 400 });
    }

    // Verify product exists and is active
    const productResult = await query(
      "SELECT id, activo FROM productos WHERE id = $1",
      [id_producto]
    );
    if (productResult.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (!productResult.rows[0].activo) {
      return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
    }

    // Upsert: add or increment quantity
    const result = await query(
      `INSERT INTO cart_items (id_usuario, id_producto, cantidad)
      VALUES ($1, $2, $3)
      ON CONFLICT (id_usuario, id_producto)
      DO UPDATE SET cantidad = cart_items.cantidad + EXCLUDED.cantidad
      RETURNING *`,
      [tokenData.userId, id_producto, cantidad]
    );

    return NextResponse.json({ item: result.rows[0] });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json({ error: "Error al agregar al carrito" }, { status: 500 });
  }
}

// PUT - Update cart item quantity
export async function PUT(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const hasCartTable = await checkCartTable();
    if (!hasCartTable) {
      return NextResponse.json({ error: "Carrito no disponible - ejecute las migraciones" }, { status: 503 });
    }

    const body = await request.json();
    const { id, cantidad } = body;

    if (!id || cantidad === undefined) {
      return NextResponse.json({ error: "id y cantidad son requeridos" }, { status: 400 });
    }

    if (cantidad < 1) {
      return NextResponse.json({ error: "Cantidad debe ser al menos 1" }, { status: 400 });
    }

    // Verify ownership
    const itemResult = await query(
      "SELECT id FROM cart_items WHERE id = $1 AND id_usuario = $2",
      [id, tokenData.userId]
    );
    if (itemResult.rows.length === 0) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    const result = await query(
      "UPDATE cart_items SET cantidad = $1 WHERE id = $2 RETURNING *",
      [cantidad, id]
    );

    return NextResponse.json({ item: result.rows[0] });
  } catch (error) {
    console.error("Error updating cart:", error);
    return NextResponse.json({ error: "Error al actualizar el carrito" }, { status: 500 });
  }
}

// DELETE - Remove item from cart or clear cart
export async function DELETE(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const hasCartTable = await checkCartTable();
    if (!hasCartTable) {
      return NextResponse.json({ error: "Carrito no disponible - ejecute las migraciones" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("id");
    const clearAll = searchParams.get("all") === "true";

    if (clearAll) {
      // Clear entire cart
      await query(
        "DELETE FROM cart_items WHERE id_usuario = $1",
        [tokenData.userId]
      );
      return NextResponse.json({ success: true, message: "Carrito vaciado" });
    }

    if (!itemId) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    // Verify ownership and delete
    const result = await query(
      "DELETE FROM cart_items WHERE id = $1 AND id_usuario = $2 RETURNING id",
      [parseInt(itemId), tokenData.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from cart:", error);
    return NextResponse.json({ error: "Error al eliminar del carrito" }, { status: 500 });
  }
}
