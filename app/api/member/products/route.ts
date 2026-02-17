import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/jwt";
import { query } from "@/lib/db";

// GET - List member's own products
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    if (userResult.rows[0].rol !== "miembro" && userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    if (!miembroId) {
      return NextResponse.json({ error: "No tienes un perfil de miembro" }, { status: 400 });
    }

    const productsResult = await query(
      `SELECT
        id, created_at, updated_at, nombre, herramientas, descripcion,
        imagen, imagenes, link_detalles, costo, categoria, activo, unico
      FROM productos
      WHERE id_miembro = $1
      ORDER BY created_at DESC`,
      [miembroId]
    );

    return NextResponse.json({ products: productsResult.rows });
  } catch (error) {
    console.error("Error fetching member products:", error);
    return NextResponse.json({ error: "Error al cargar productos" }, { status: 500 });
  }
}

// POST - Create new product
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "miembro") {
      return NextResponse.json({ error: "Solo miembros pueden crear productos" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    if (!miembroId) {
      return NextResponse.json({ error: "No tienes un perfil de miembro" }, { status: 400 });
    }

    const body = await request.json();
    const { nombre, descripcion, costo, categoria, herramientas, imagenes, link_detalles, unico } = body;

    if (!nombre || nombre.trim() === "") {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO productos (
        nombre, descripcion, costo, categoria, herramientas, imagenes, imagen, link_detalles, id_miembro, activo, created_at, unico
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), $10)
      RETURNING *`,
      [
        nombre.trim(),
        descripcion?.trim() || null,
        costo || null,
        categoria?.trim() || null,
        herramientas ? JSON.stringify(herramientas) : null,
        imagenes ? JSON.stringify(imagenes) : "[]",
        imagenes && imagenes.length > 0 ? imagenes[0] : null, // Keep first image in legacy field
        link_detalles?.trim() || null,
        miembroId,
        unico || false,
      ]
    );

    return NextResponse.json({ product: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Error al crear el producto" }, { status: 500 });
  }
}

// PUT - Update product
export async function PUT(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "miembro") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;

    const body = await request.json();
    const { id, nombre, descripcion, costo, categoria, herramientas, imagenes, link_detalles, activo, unico } = body;

    if (!id) {
      return NextResponse.json({ error: "ID del producto es requerido" }, { status: 400 });
    }

    // Verify ownership
    const productResult = await query(
      "SELECT id, id_miembro FROM productos WHERE id = $1",
      [id]
    );
    if (productResult.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (productResult.rows[0].id_miembro !== miembroId) {
      return NextResponse.json({ error: "No autorizado para editar este producto" }, { status: 403 });
    }

    const result = await query(
      `UPDATE productos SET
        nombre = COALESCE($1, nombre),
        descripcion = COALESCE($2, descripcion),
        costo = COALESCE($3, costo),
        categoria = COALESCE($4, categoria),
        herramientas = COALESCE($5, herramientas),
        imagenes = COALESCE($6, imagenes),
        imagen = COALESCE($7, imagen),
        link_detalles = COALESCE($8, link_detalles),
        activo = COALESCE($9, activo),
        unico = COALESCE($10, unico)
      WHERE id = $11
      RETURNING *`,
      [
        nombre?.trim() || null,
        descripcion?.trim() || null,
        costo,
        categoria?.trim() || null,
        herramientas ? JSON.stringify(herramientas) : null,
        imagenes ? JSON.stringify(imagenes) : null,
        imagenes && imagenes.length > 0 ? imagenes[0] : null,
        link_detalles?.trim() || null,
        activo,
        typeof unico === 'boolean' ? unico : null,
        id,
      ]
    );

    return NextResponse.json({ product: result.rows[0] });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Error al actualizar el producto" }, { status: 500 });
  }
}

// DELETE - Delete product
export async function DELETE(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "miembro") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("id");

    if (!productId) {
      return NextResponse.json({ error: "ID del producto es requerido" }, { status: 400 });
    }

    // Verify ownership
    const productResult = await query(
      "SELECT id, id_miembro FROM productos WHERE id = $1",
      [parseInt(productId)]
    );
    if (productResult.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (productResult.rows[0].id_miembro !== miembroId) {
      return NextResponse.json({ error: "No autorizado para eliminar este producto" }, { status: 403 });
    }

    await query("DELETE FROM productos WHERE id = $1", [parseInt(productId)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Error al eliminar el producto" }, { status: 500 });
  }
}
