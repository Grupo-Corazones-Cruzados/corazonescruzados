import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Check if extended columns exist
let hasExtendedSchema: boolean | null = null;
let hasUnicoColumn: boolean | null = null;

async function checkExtendedSchema(): Promise<boolean> {
  if (hasExtendedSchema !== null) return hasExtendedSchema;
  try {
    await query("SELECT imagenes, categoria, activo FROM productos LIMIT 0");
    hasExtendedSchema = true;
  } catch {
    hasExtendedSchema = false;
  }
  return hasExtendedSchema;
}

async function checkUnicoColumn(): Promise<boolean> {
  if (hasUnicoColumn !== null) return hasUnicoColumn;
  try {
    await query("SELECT unico FROM productos LIMIT 0");
    hasUnicoColumn = true;
  } catch {
    hasUnicoColumn = false;
  }
  return hasUnicoColumn;
}

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

    const hasExtended = await checkExtendedSchema();
    const hasUnico = await checkUnicoColumn();

    // Build SELECT columns based on schema
    const baseCols = `p.id, p.created_at, p.nombre, p.herramientas, p.descripcion,
        p.imagen, p.link_detalles, p.costo, p.id_miembro`;
    const extCols = hasExtended ? `, p.updated_at, p.imagenes, p.categoria, p.activo` : "";
    const unicoCol = hasUnico ? ", p.unico" : "";

    // Get product with vendor info
    const productResult = await query(
      `SELECT
        ${baseCols}${extCols}${unicoCol},
        m.id as vendedor_id,
        m.nombre as vendedor_nombre,
        COALESCE(m.foto, up.avatar_url) as vendedor_foto,
        m.puesto as vendedor_puesto,
        m.descripcion as vendedor_descripcion,
        m.correo as vendedor_correo
      FROM productos p
      LEFT JOIN miembros m ON p.id_miembro = m.id
      LEFT JOIN user_profiles up ON up.id_miembro = m.id
      WHERE p.id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const row = productResult.rows[0];
    const product = {
      ...row,
      imagenes: row.imagenes || (row.imagen ? [row.imagen] : []),
      categoria: row.categoria || null,
      activo: row.activo !== undefined ? row.activo : true,
      unico: row.unico || false,
    };

    // Get related products (same category, exclude current)
    let relatedProducts: any[] = [];
    const activoFilter = hasExtended ? "AND (p.activo = true OR p.activo IS NULL)" : "";

    if (product.categoria) {
      const relatedResult = await query(
        `SELECT
          p.id, p.nombre, p.descripcion, p.imagen, ${hasExtended ? "p.imagenes," : ""} p.costo, ${hasExtended ? "p.categoria," : ""}
          m.nombre as vendedor_nombre,
          COALESCE(m.foto, up.avatar_url) as vendedor_foto
        FROM productos p
        LEFT JOIN miembros m ON p.id_miembro = m.id
        LEFT JOIN user_profiles up ON up.id_miembro = m.id
        WHERE p.categoria = $1 AND p.id != $2 ${activoFilter}
        ORDER BY p.created_at DESC
        LIMIT 4`,
        [product.categoria, productId]
      );
      relatedProducts = relatedResult.rows;
    }

    // If not enough related products, fill with random products
    if (relatedProducts.length < 4) {
      const remaining = 4 - relatedProducts.length;
      const excludeIds = [productId, ...relatedProducts.map((p: any) => p.id)];
      const moreResult = await query(
        `SELECT
          p.id, p.nombre, p.descripcion, p.imagen, ${hasExtended ? "p.imagenes," : ""} p.costo, ${hasExtended ? "p.categoria," : ""}
          m.nombre as vendedor_nombre,
          COALESCE(m.foto, up.avatar_url) as vendedor_foto
        FROM productos p
        LEFT JOIN miembros m ON p.id_miembro = m.id
        LEFT JOIN user_profiles up ON up.id_miembro = m.id
        WHERE p.id != ALL($1) ${activoFilter}
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
