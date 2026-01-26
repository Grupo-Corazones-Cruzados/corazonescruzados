import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/stats - Get admin dashboard statistics
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const userResult = await query(
      `SELECT rol FROM user_profiles WHERE user_id = $1`,
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Get user statistics
    const usuariosStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rol = 'cliente') as clientes,
        COUNT(*) FILTER (WHERE rol = 'miembro') as miembros,
        COUNT(*) FILTER (WHERE rol = 'admin') as admins,
        COUNT(*) FILTER (WHERE verificado = true) as verificados
      FROM user_profiles
    `);

    // Get ticket statistics
    const ticketsStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'en_progreso') as en_progreso,
        COUNT(*) FILTER (WHERE estado = 'completado') as completados
      FROM tickets
    `);

    // Get project statistics
    const proyectosStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE publicado = true) as publicados,
        COUNT(*) FILTER (WHERE miembro_asignado IS NOT NULL) as asignados,
        COUNT(*) FILTER (WHERE estado = 'completado') as completados
      FROM proyectos
    `);

    // Get invoice statistics
    const facturasStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'pagada') as pagadas,
        COALESCE(SUM(CASE WHEN estado = 'pagada' THEN total ELSE 0 END), 0) as total_ingresos
      FROM facturas
    `);

    // Get member statistics
    const miembrosStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE activo = true) as activos
      FROM miembros
    `);

    return NextResponse.json({
      usuarios: {
        total: parseInt(usuariosStats.rows[0].total) || 0,
        clientes: parseInt(usuariosStats.rows[0].clientes) || 0,
        miembros: parseInt(usuariosStats.rows[0].miembros) || 0,
        admins: parseInt(usuariosStats.rows[0].admins) || 0,
        verificados: parseInt(usuariosStats.rows[0].verificados) || 0,
      },
      tickets: {
        total: parseInt(ticketsStats.rows[0].total) || 0,
        pendientes: parseInt(ticketsStats.rows[0].pendientes) || 0,
        enProgreso: parseInt(ticketsStats.rows[0].en_progreso) || 0,
        completados: parseInt(ticketsStats.rows[0].completados) || 0,
      },
      proyectos: {
        total: parseInt(proyectosStats.rows[0].total) || 0,
        publicados: parseInt(proyectosStats.rows[0].publicados) || 0,
        asignados: parseInt(proyectosStats.rows[0].asignados) || 0,
        completados: parseInt(proyectosStats.rows[0].completados) || 0,
      },
      facturas: {
        total: parseInt(facturasStats.rows[0].total) || 0,
        pendientes: parseInt(facturasStats.rows[0].pendientes) || 0,
        pagadas: parseInt(facturasStats.rows[0].pagadas) || 0,
        totalIngresos: parseFloat(facturasStats.rows[0].total_ingresos) || 0,
      },
      miembros: {
        total: parseInt(miembrosStats.rows[0].total) || 0,
        activos: parseInt(miembrosStats.rows[0].activos) || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Error al cargar estadísticas" },
      { status: 500 }
    );
  }
}
