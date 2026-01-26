import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/calendar - Get calendar events for a date range
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Se requieren fechas de inicio y fin" }, { status: 400 });
    }

    // Get user profile
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { rol, id_miembro } = userResult.rows[0];

    let sql = `
      SELECT
        ts.id,
        ts.fecha,
        ts.hora_inicio,
        ts.hora_fin,
        ts.estado,
        json_build_object(
          'id', t.id,
          'titulo', t.titulo,
          'cliente', json_build_object('nombre', c.nombre),
          'miembro', json_build_object('nombre', m.nombre)
        ) as ticket
      FROM ticket_slots ts
      LEFT JOIN tickets t ON ts.id_ticket = t.id
      LEFT JOIN clientes c ON t.id_cliente = c.id
      LEFT JOIN miembros m ON t.id_miembro = m.id
      WHERE ts.fecha >= $1 AND ts.fecha <= $2
        AND ts.estado != 'cancelado'
    `;

    const params: any[] = [startDate, endDate];
    let paramIndex = 3;

    // Role-based filtering
    if (rol === "miembro" && id_miembro) {
      sql += ` AND t.id_miembro = $${paramIndex}`;
      params.push(id_miembro);
      paramIndex++;
    } else if (rol === "cliente") {
      // Get client ID from email
      const clientResult = await query(
        "SELECT id FROM clientes WHERE correo_electronico = $1",
        [tokenData.email]
      );
      if (clientResult.rows.length > 0) {
        sql += ` AND t.id_cliente = $${paramIndex}`;
        params.push(clientResult.rows[0].id);
        paramIndex++;
      } else {
        return NextResponse.json({ events: [] });
      }
    }

    sql += " ORDER BY ts.fecha, ts.hora_inicio";

    const result = await query(sql, params);

    return NextResponse.json({ events: result.rows });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json({ error: "Error al cargar los eventos" }, { status: 500 });
  }
}
