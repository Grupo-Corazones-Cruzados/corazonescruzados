import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Check if new marketplace columns exist
let hasNewColumns: boolean | null = null;

async function checkNewColumns(): Promise<boolean> {
  if (hasNewColumns !== null) return hasNewColumns;
  try {
    await query("SELECT imagenes, categoria, activo FROM productos LIMIT 0");
    hasNewColumns = true;
  } catch {
    hasNewColumns = false;
  }
  return hasNewColumns;
}

// GET /api/mercado - Get marketplace data (products, members, CV)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const miembroId = searchParams.get("miembroId");

    // New filter parameters for marketplace browsing
    const search = searchParams.get("search");
    const categoria = searchParams.get("categoria");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const vendedorId = searchParams.get("vendedorId");

    const hasExtendedSchema = await checkNewColumns();

    if (miembroId) {
      // Get specific member data with products
      const memberResult = await query(
        `SELECT
          id, nombre, puesto, descripcion, foto, correo, celular, cod_usuario, cv_profile
        FROM miembros
        WHERE id = $1`,
        [miembroId]
      );

      if (memberResult.rows.length === 0) {
        return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
      }

      const member = memberResult.rows[0];

      // Get CV profile if exists
      let cvProfile = null;
      if (member.cv_profile) {
        try {
          const cvResult = await query(
            `SELECT * FROM cv_profile WHERE id = $1`,
            [member.cv_profile]
          );
          if (cvResult.rows.length > 0) {
            cvProfile = cvResult.rows[0];
          }
        } catch {
          // cv_profile table doesn't exist yet, skip
        }
      }

      // Get member products (with or without extended columns)
      const selectCols = hasExtendedSchema
        ? "id, created_at, nombre, herramientas, descripcion, imagen, imagenes, link_detalles, costo, categoria, activo, id_miembro"
        : "id, created_at, nombre, herramientas, descripcion, imagen, link_detalles, costo, id_miembro";

      const productsResult = await query(
        `SELECT ${selectCols}
        FROM productos
        WHERE id_miembro = $1
        ORDER BY created_at DESC`,
        [miembroId]
      );

      // Normalize products to always have expected fields
      const products = productsResult.rows.map((p) => ({
        ...p,
        imagenes: p.imagenes || (p.imagen ? [p.imagen] : []),
        categoria: p.categoria || null,
        activo: p.activo !== undefined ? p.activo : true,
      }));

      return NextResponse.json({
        member: { ...member, cvProfile },
        products,
      });
    } else {
      // Build dynamic query for marketplace browsing
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Only filter by activo if column exists
      if (hasExtendedSchema) {
        conditions.push("(p.activo = true OR p.activo IS NULL)");
      }

      if (search) {
        conditions.push(`(p.nombre ILIKE $${paramIndex} OR p.descripcion ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (categoria && hasExtendedSchema) {
        conditions.push(`p.categoria = $${paramIndex}`);
        params.push(categoria);
        paramIndex++;
      }

      if (minPrice) {
        conditions.push(`p.costo >= $${paramIndex}`);
        params.push(parseFloat(minPrice));
        paramIndex++;
      }

      if (maxPrice) {
        conditions.push(`p.costo <= $${paramIndex}`);
        params.push(parseFloat(maxPrice));
        paramIndex++;
      }

      if (vendedorId) {
        conditions.push(`p.id_miembro = $${paramIndex}`);
        params.push(parseInt(vendedorId));
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Build SELECT clause based on schema
      const selectCols = hasExtendedSchema
        ? `p.id, p.created_at, p.nombre, p.herramientas, p.descripcion,
           p.imagen, p.imagenes, p.link_detalles, p.costo, p.categoria, p.id_miembro`
        : `p.id, p.created_at, p.nombre, p.herramientas, p.descripcion,
           p.imagen, p.link_detalles, p.costo, p.id_miembro`;

      // Get products with vendor info
      const productsResult = await query(
        `SELECT
          ${selectCols},
          m.nombre as vendedor_nombre,
          COALESCE(m.foto, up.avatar_url) as vendedor_foto,
          m.puesto as vendedor_puesto
        FROM productos p
        LEFT JOIN miembros m ON p.id_miembro = m.id
        LEFT JOIN user_profiles up ON up.id_miembro = m.id
        ${whereClause}
        ORDER BY p.created_at DESC`,
        params
      );

      // Normalize products
      const products = productsResult.rows.map((p) => ({
        ...p,
        imagenes: p.imagenes || (p.imagen ? [p.imagen] : []),
        categoria: p.categoria || null,
        activo: p.activo !== undefined ? p.activo : true,
      }));

      // Get distinct categories for filters (only if schema supports it)
      let categories: string[] = [];
      if (hasExtendedSchema) {
        try {
          const categoriesResult = await query(
            `SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL ORDER BY categoria`
          );
          categories = categoriesResult.rows.map((r) => r.categoria).filter(Boolean);
        } catch {
          categories = [];
        }
      }

      // Get CV for legacy support (optional - table may not exist)
      let cv = null;
      try {
        const cvResult = await query(
          `SELECT * FROM cv_profile ORDER BY updated_at DESC NULLS LAST LIMIT 1`
        );
        cv = cvResult.rows[0] || null;
      } catch {
        // cv_profile table doesn't exist, skip
      }

      return NextResponse.json({
        products,
        categories,
        cv,
      });
    }
  } catch (error) {
    console.error("Error fetching mercado data:", error);
    return NextResponse.json({ error: "Error al cargar datos del mercado" }, { status: 500 });
  }
}
