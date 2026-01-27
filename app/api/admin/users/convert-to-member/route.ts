import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/admin/users/convert-to-member - Convert user to member
export async function POST(request: NextRequest) {
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
    const { userId, puesto, descripcion, costo, id_fuente } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "ID de usuario requerido" },
        { status: 400 }
      );
    }

    // Get user data
    const userResult = await query(
      `SELECT id, email, nombre, apellido, telefono, avatar_url, id_miembro
       FROM user_profiles WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Check if user is already a member
    if (user.id_miembro) {
      return NextResponse.json(
        { error: "El usuario ya es un miembro" },
        { status: 400 }
      );
    }

    // Create member record
    const nombreCompleto = [user.nombre, user.apellido].filter(Boolean).join(" ") || user.email.split("@")[0];

    const memberResult = await query(
      `INSERT INTO miembros (nombre, puesto, descripcion, foto, costo, correo, id_fuente, celular)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nombre, puesto, descripcion, foto, costo, correo`,
      [
        nombreCompleto,
        puesto || "Miembro",
        descripcion || null,
        user.avatar_url || null,
        costo || 0,
        user.email,
        id_fuente || null,
        user.telefono || null,
      ]
    );

    const newMember = memberResult.rows[0];

    // Update user profile with member ID and role
    await query(
      `UPDATE user_profiles
       SET rol = 'miembro', id_miembro = $1, verificado = true
       WHERE id = $2`,
      [newMember.id, userId]
    );

    // Get updated user
    const updatedUserResult = await query(
      `SELECT up.id, up.email, up.nombre, up.apellido, up.telefono, up.avatar_url,
              up.rol, up.verificado, up.id_miembro, up.created_at,
              m.nombre as miembro_nombre, m.puesto as miembro_puesto
       FROM user_profiles up
       LEFT JOIN miembros m ON up.id_miembro = m.id
       WHERE up.id = $1`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      user: updatedUserResult.rows[0],
      member: newMember,
    });
  } catch (error) {
    console.error("Error converting user to member:", error);
    return NextResponse.json(
      { error: "Error al convertir usuario a miembro" },
      { status: 500 }
    );
  }
}
