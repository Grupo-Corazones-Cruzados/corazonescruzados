import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ miembroId: string }> };

// GET /api/public/portfolio/[miembroId] - Get public portfolio for a member
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { miembroId } = await context.params;
    const memberId = parseInt(miembroId);

    if (isNaN(memberId)) {
      return NextResponse.json({ error: "ID de miembro inválido" }, { status: 400 });
    }

    // Verify member exists and is public
    const memberResult = await query(
      "SELECT id, nombre, puesto, foto FROM miembros WHERE id = $1 AND estado = 'activo'",
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    const member = memberResult.rows[0];

    // Get portfolio entries
    const portfolioResult = await query(
      `SELECT
         mp.id,
         mp.titulo,
         mp.descripcion,
         mp.funciones,
         mp.monto_ganado,
         mp.fecha_proyecto_completado,
         mp.created_at
       FROM member_portfolio mp
       WHERE mp.id_miembro = $1
       ORDER BY mp.fecha_proyecto_completado DESC NULLS LAST, mp.created_at DESC`,
      [memberId]
    );

    // Calculate stats
    const totalProjects = portfolioResult.rows.length;
    const totalFunctions = portfolioResult.rows.reduce((sum: number, p: any) => {
      const funcs = p.funciones || [];
      return sum + (Array.isArray(funcs) ? funcs.length : 0);
    }, 0);

    return NextResponse.json({
      member: {
        id: member.id,
        nombre: member.nombre,
        puesto: member.puesto,
        foto: member.foto,
      },
      portfolio: portfolioResult.rows,
      stats: {
        totalProjects,
        totalFunctions,
      },
    });
  } catch (error) {
    console.error("Error fetching public portfolio:", error);
    return NextResponse.json({ error: "Error al cargar el portafolio" }, { status: 500 });
  }
}
