import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/mercado/[id] - Get product detail with vendor info and related products
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // Get product with vendor info
    const productResult = await query(
      `SELECT
        p.id, p.created_at, p.updated_at, p.nombre, p.herramientas, p.descripcion,
        p.imagen, p.imagenes, p.link_detalles, p.costo, p.categoria, p.activo, p.id_miembro,
        m.id as vendedor_id,
        m.nombre as vendedor_nombre,
        m.foto as vendedor_foto,
        m.puesto as vendedor_puesto,
        m.descripcion as vendedor_descripcion,
        m.correo as vendedor_correo
      FROM productos p
      LEFT JOIN miembros m ON p.id_miembro = m.id
      WHERE p.id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const product = productResult.rows[0];

    // Get related products (same category, exclude current)
    let relatedProducts: any[] = [];
    if (product.categoria) {
      const relatedResult = await query(
        `SELECT
          p.id, p.nombre, p.descripcion, p.imagen, p.imagenes, p.costo, p.categoria,
          m.nombre as vendedor_nombre,
          m.foto as vendedor_foto
        FROM productos p
        LEFT JOIN miembros m ON p.id_miembro = m.id
        WHERE p.categoria = $1 AND p.id != $2 AND p.activo = true
        ORDER BY p.created_at DESC
        LIMIT 4`,
        [product.categoria, productId]
      );
      relatedProducts = relatedResult.rows;
    }

    // If not enough related products, fill with random products
    if (relatedProducts.length < 4) {
      const remaining = 4 - relatedProducts.length;
      const excludeIds = [productId, ...relatedProducts.map((p) => p.id)];
      const moreResult = await query(
        `SELECT
          p.id, p.nombre, p.descripcion, p.imagen, p.imagenes, p.costo, p.categoria,
          m.nombre as vendedor_nombre,
          m.foto as vendedor_foto
        FROM productos p
        LEFT JOIN miembros m ON p.id_miembro = m.id
        WHERE p.id != ALL($1) AND p.activo = true
        ORDER BY RANDOM()
        LIMIT $2`,
        [excludeIds, remaining]
      );
      relatedProducts = [...relatedProducts, ...moreResult.rows];
    }

    return NextResponse.json({
      product,
      relatedProducts,
    });
  } catch (error) {
    console.error("Error fetching product detail:", error);
    return NextResponse.json({ error: "Error al cargar el producto" }, { status: 500 });
  }
}
