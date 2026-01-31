import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/users - List all users with pagination
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const rol = searchParams.get("rol") || "";
    const offset = (page - 1) * limit;

    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (up.email ILIKE $${paramIndex} OR up.nombre ILIKE $${paramIndex} OR up.apellido ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (rol) {
      whereClause += ` AND up.rol = $${paramIndex}`;
      params.push(rol);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM user_profiles up ${whereClause}`,
      params
    );

    // Get users with miembro info
    const usersResult = await query(
      `SELECT
        up.id,
        up.email,
        up.nombre,
        up.apellido,
        up.telefono,
        up.avatar_url,
        up.rol,
        up.verificado,
        up.id_miembro,
        up.created_at,
        up.estado,
        m.nombre as miembro_nombre,
        m.puesto as miembro_puesto
      FROM user_profiles up
      LEFT JOIN miembros m ON up.id_miembro = m.id
      ${whereClause}
      ORDER BY up.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      users: usersResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Error al cargar usuarios" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users - Update user data
export async function PATCH(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const adminResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (adminResult.rows.length === 0 || adminResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, rol, verificado, nombre, apellido, telefono, id_miembro } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 }
      );
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (rol !== undefined) {
      if (!["cliente", "miembro", "admin"].includes(rol)) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      updates.push(`rol = $${paramIndex}`);
      params.push(rol);
      paramIndex++;
    }

    if (verificado !== undefined) {
      updates.push(`verificado = $${paramIndex}`);
      params.push(verificado);
      paramIndex++;
    }

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex}`);
      params.push(nombre || null);
      paramIndex++;
    }

    if (apellido !== undefined) {
      updates.push(`apellido = $${paramIndex}`);
      params.push(apellido || null);
      paramIndex++;
    }

    if (telefono !== undefined) {
      updates.push(`telefono = $${paramIndex}`);
      params.push(telefono || null);
      paramIndex++;
    }

    if (id_miembro !== undefined) {
      updates.push(`id_miembro = $${paramIndex}`);
      params.push(id_miembro || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 }
      );
    }

    params.push(userId);
    const result = await query(
      `UPDATE user_profiles
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, email, nombre, apellido, telefono, avatar_url, rol, verificado, id_miembro, created_at`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    );
  }
}
