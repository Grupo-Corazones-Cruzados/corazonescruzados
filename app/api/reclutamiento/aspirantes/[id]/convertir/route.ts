import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { getReclutamientoAccess } from "@/lib/reclutamiento";

// POST /api/reclutamiento/aspirantes/[id]/convertir - Convert aspirant to member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const access = await getReclutamientoAccess(tokenData.userId);
    if (access.rol === "cliente") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { puesto, descripcion, costo } = body;

    if (!puesto) {
      return NextResponse.json(
        { error: "El puesto es requerido" },
        { status: 400 }
      );
    }

    // Get postulación and user data
    const postResult = await query(
      `SELECT p.id, p.id_usuario,
              up.nombre, up.apellido, up.email, up.telefono, up.avatar_url, up.id_miembro
       FROM postulaciones p
       JOIN user_profiles up ON p.id_usuario = up.id
       WHERE p.id = $1`,
      [id]
    );

    if (postResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Postulación no encontrada" },
        { status: 404 }
      );
    }

    const user = postResult.rows[0];

    if (user.id_miembro) {
      return NextResponse.json(
        { error: "Este usuario ya es un miembro" },
        { status: 400 }
      );
    }

    // Create member record
    const nombreCompleto =
      [user.nombre, user.apellido].filter(Boolean).join(" ") ||
      user.email.split("@")[0];

    const memberResult = await query(
      `INSERT INTO miembros (nombre, puesto, descripcion, foto, costo, correo, celular)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, nombre, puesto, descripcion, foto, costo, correo`,
      [
        nombreCompleto,
        puesto,
        descripcion || null,
        user.avatar_url || null,
        costo || 0,
        user.email,
        user.telefono || null,
      ]
    );

    const newMember = memberResult.rows[0];

    // Update user profile with member ID and role
    await query(
      `UPDATE user_profiles
       SET rol = 'miembro', id_miembro = $1, verificado = true
       WHERE id = $2`,
      [newMember.id, user.id_usuario]
    );

    // Get updated user
    const updatedUserResult = await query(
      `SELECT up.id, up.email, up.nombre, up.apellido, up.telefono, up.avatar_url,
              up.rol, up.verificado, up.id_miembro, up.created_at,
              m.nombre as miembro_nombre, m.puesto as miembro_puesto
       FROM user_profiles up
       LEFT JOIN miembros m ON up.id_miembro = m.id
       WHERE up.id = $1`,
      [user.id_usuario]
    );

    return NextResponse.json({
      success: true,
      user: updatedUserResult.rows[0],
      member: newMember,
    });
  } catch (error) {
    console.error("Error converting aspirante to member:", error);
    return NextResponse.json(
      { error: "Error al convertir aspirante a miembro" },
      { status: 500 }
    );
  }
}
