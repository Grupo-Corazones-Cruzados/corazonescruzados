import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/client/packages - List client's package purchases
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado") || "";
    const miembroFilter = searchParams.get("miembro");

    let sql = `
      SELECT
        pp.*,
        json_build_object(
          'id', p.id,
          'nombre', p.nombre,
          'horas', p.horas,
          'descripcion', p.descripcion
        ) as paquete,
        json_build_object(
          'id', m.id,
          'nombre', m.nombre,
          'foto', m.foto,
          'puesto', m.puesto
        ) as miembro
      FROM package_purchases pp
      JOIN paquetes p ON pp.id_paquete = p.id
      JOIN miembros m ON pp.id_miembro = m.id
      WHERE pp.id_cliente = $1
    `;

    const params: any[] = [tokenData.userId];
    let paramIndex = 2;

    // Filter by estado
    if (estado === "activos") {
      sql += ` AND pp.estado IN ('pendiente', 'aprobado', 'en_espera', 'en_progreso')`;
    } else if (estado === "cerrados") {
      sql += ` AND pp.estado IN ('completado', 'cancelado', 'rechazado', 'expirado')`;
    } else if (estado && estado !== "todos") {
      sql += ` AND pp.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    // Filter by member
    if (miembroFilter) {
      sql += ` AND pp.id_miembro = $${paramIndex}`;
      params.push(parseInt(miembroFilter));
      paramIndex++;
    }

    sql += " ORDER BY pp.created_at DESC";

    const result = await query(sql, params);

    // Calculate stats
    const allPurchases = await query(
      `SELECT estado FROM package_purchases WHERE id_cliente = $1`,
      [tokenData.userId]
    );

    const stats = {
      total: allPurchases.rows.length,
      pendientes: allPurchases.rows.filter(
        (p) => p.estado === "pendiente" || p.estado === "en_espera"
      ).length,
      activos: allPurchases.rows.filter(
        (p) => p.estado === "aprobado" || p.estado === "en_progreso"
      ).length,
      completados: allPurchases.rows.filter((p) => p.estado === "completado")
        .length,
    };

    return NextResponse.json({
      purchases: result.rows,
      stats,
    });
  } catch (error) {
    console.error("Error fetching client packages:", error);
    return NextResponse.json(
      { error: "Error al cargar los paquetes" },
      { status: 500 }
    );
  }
}
