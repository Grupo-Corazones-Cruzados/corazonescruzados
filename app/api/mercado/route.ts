import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/mercado - Get marketplace data (products, members, CV)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const miembroId = searchParams.get("miembroId");

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
        const cvResult = await query(
          `SELECT * FROM cv_profile WHERE id = $1`,
          [member.cv_profile]
        );
        if (cvResult.rows.length > 0) {
          cvProfile = cvResult.rows[0];
        }
      }

      // Get member products
      const productsResult = await query(
        `SELECT
          id, created_at, nombre, herramientas, descripcion, imagen, link_detalles, costo, id_miembro
        FROM productos
        WHERE id_miembro = $1
        ORDER BY created_at DESC`,
        [miembroId]
      );

      return NextResponse.json({
        member: { ...member, cvProfile },
        products: productsResult.rows,
      });
    } else {
      // Get all products and latest CV
      const [productsResult, cvResult] = await Promise.all([
        query(
          `SELECT
            id, created_at, nombre, herramientas, descripcion, imagen, link_detalles, costo, id_miembro
          FROM productos
          ORDER BY created_at DESC`
        ),
        query(
          `SELECT * FROM cv_profile ORDER BY updated_at DESC NULLS LAST LIMIT 1`
        ),
      ]);

      return NextResponse.json({
        products: productsResult.rows,
        cv: cvResult.rows[0] || null,
      });
    }
  } catch (error) {
    console.error("Error fetching mercado data:", error);
    return NextResponse.json({ error: "Error al cargar datos del mercado" }, { status: 500 });
  }
}
