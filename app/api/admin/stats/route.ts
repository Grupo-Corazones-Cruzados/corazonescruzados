import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// Helper function to safely query a table that might not exist
async function safeQuery(sql: string, defaultValue: Record<string, number> = {}) {
  try {
    const result = await query(sql);
    return result.rows[0] || defaultValue;
  } catch {
    return defaultValue;
  }
}

// GET /api/admin/stats - Get admin dashboard statistics
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const userResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Get user statistics
    const usuariosStats = await safeQuery(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rol = 'cliente') as clientes,
        COUNT(*) FILTER (WHERE rol = 'miembro') as miembros,
        COUNT(*) FILTER (WHERE rol = 'admin') as admins,
        COUNT(*) FILTER (WHERE verificado = true) as verificados
      FROM user_profiles
    `, { total: 0, clientes: 0, miembros: 0, admins: 0, verificados: 0 });

    // Get ticket statistics
    const ticketsStats = await safeQuery(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'en_progreso') as en_progreso,
        COUNT(*) FILTER (WHERE estado = 'completado') as completados
      FROM tickets
    `, { total: 0, pendientes: 0, en_progreso: 0, completados: 0 });

    // Get project statistics (table might not exist)
    const proyectosStats = await safeQuery(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'activo') as activos,
        COUNT(*) FILTER (WHERE id_miembro IS NOT NULL) as asignados,
        COUNT(*) FILTER (WHERE estado = 'completado') as completados
      FROM proyectos
    `, { total: 0, activos: 0, asignados: 0, completados: 0 });

    // Get member statistics
    const miembrosStats = await safeQuery(`
      SELECT COUNT(*) as total FROM miembros
    `, { total: 0 });

    return NextResponse.json({
      usuarios: {
        total: parseInt(usuariosStats.total) || 0,
        clientes: parseInt(usuariosStats.clientes) || 0,
        miembros: parseInt(usuariosStats.miembros) || 0,
        admins: parseInt(usuariosStats.admins) || 0,
        verificados: parseInt(usuariosStats.verificados) || 0,
      },
      tickets: {
        total: parseInt(ticketsStats.total) || 0,
        pendientes: parseInt(ticketsStats.pendientes) || 0,
        enProgreso: parseInt(ticketsStats.en_progreso) || 0,
        completados: parseInt(ticketsStats.completados) || 0,
      },
      proyectos: {
        total: parseInt(proyectosStats.total) || 0,
        activos: parseInt(proyectosStats.activos) || 0,
        asignados: parseInt(proyectosStats.asignados) || 0,
        completados: parseInt(proyectosStats.completados) || 0,
      },
      miembros: {
        total: parseInt(miembrosStats.total) || 0,
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
