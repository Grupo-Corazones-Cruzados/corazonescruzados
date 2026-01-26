import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await query(
      `SELECT id, email, nombre, apellido, avatar_url, telefono, rol, id_miembro, verificado
       FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Error al cargar el perfil" }, { status: 500 });
  }
}

// PATCH /api/profile - Update current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ["nombre", "apellido", "avatar_url", "telefono"];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(tokenData.userId);
    const sql = `UPDATE user_profiles SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, email, nombre, apellido, avatar_url, telefono, rol, id_miembro, verificado`;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ profile: result.rows[0] });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
