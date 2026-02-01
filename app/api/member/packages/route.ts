import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/member/packages - List packages assigned to member
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get member ID from user profile
    const userResult = await query(
      "SELECT id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].id_miembro) {
      return NextResponse.json(
        { error: "No eres un miembro" },
        { status: 403 }
      );
    }

    const idMiembro = userResult.rows[0].id_miembro;

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado") || "";
    const clienteFilter = searchParams.get("cliente");

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
          'id', up.id,
          'nombre', COALESCE(up.nombre || ' ' || COALESCE(up.apellido, ''), up.email),
          'correo_electronico', up.email
        ) as cliente
      FROM package_purchases pp
      JOIN paquetes p ON pp.id_paquete = p.id
      JOIN user_profiles up ON pp.id_cliente = up.id
      WHERE pp.id_miembro = $1
    `;

    const params: any[] = [idMiembro];
    let paramIndex = 2;

    // Filter by estado
    if (estado === "pendientes") {
      sql += ` AND pp.estado IN ('pendiente')`;
    } else if (estado === "activos") {
      sql += ` AND pp.estado IN ('aprobado', 'en_espera', 'en_progreso')`;
    } else if (estado === "cerrados") {
      sql += ` AND pp.estado IN ('completado', 'cancelado', 'rechazado', 'expirado')`;
    } else if (estado && estado !== "todos") {
      sql += ` AND pp.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    // Filter by client (UUID)
    if (clienteFilter) {
      sql += ` AND pp.id_cliente = $${paramIndex}`;
      params.push(clienteFilter);
      paramIndex++;
    }

    sql += " ORDER BY pp.created_at DESC";

    const result = await query(sql, params);

    // Calculate stats
    const allPurchases = await query(
      `SELECT estado FROM package_purchases WHERE id_miembro = $1`,
      [idMiembro]
    );

    const stats = {
      total: allPurchases.rows.length,
      pendientes: allPurchases.rows.filter((p) => p.estado === "pendiente")
        .length,
      activos: allPurchases.rows.filter(
        (p) =>
          p.estado === "aprobado" ||
          p.estado === "en_espera" ||
          p.estado === "en_progreso"
      ).length,
      completados: allPurchases.rows.filter((p) => p.estado === "completado")
        .length,
    };

    return NextResponse.json({
      purchases: result.rows,
      stats,
    });
  } catch (error) {
    console.error("Error fetching member packages:", error);
    return NextResponse.json(
      { error: "Error al cargar los paquetes" },
      { status: 500 }
    );
  }
}
