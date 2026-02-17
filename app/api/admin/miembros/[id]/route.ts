import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/miembros/[id] - Get single member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const result = await query(
      `SELECT m.*, f.nombre as fuente_nombre, pa.nombre as paso_nombre, ps.nombre as piso_nombre
       FROM miembros m
       LEFT JOIN fuentes f ON m.id_fuente = f.id
       LEFT JOIN pasos pa ON m.id_paso = pa.id
       LEFT JOIN pisos ps ON m.id_piso = ps.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Miembro no encontrado" },
        { status: 404 }
      );
    }

    // Fetch sistemas for this miembro
    const sistemasResult = await query(
      `SELECT s.id, s.nombre
       FROM miembros_sistemas ms
       JOIN sistemas s ON ms.id_sistema = s.id
       WHERE ms.id_miembro = $1
       ORDER BY s.secuencia ASC, s.id ASC`,
      [id]
    );

    const miembro = {
      ...result.rows[0],
      sistemas: sistemasResult.rows,
    };

    return NextResponse.json({ miembro });
  } catch (error) {
    console.error("Error fetching miembro:", error);
    return NextResponse.json(
      { error: "Error al cargar miembro" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/miembros/[id] - Update member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { nombre, puesto, descripcion, foto, costo, correo, celular, id_fuente, id_paso, id_piso, sistemas_ids } = body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex}`);
      values.push(nombre);
      paramIndex++;
    }

    if (puesto !== undefined) {
      updates.push(`puesto = $${paramIndex}`);
      values.push(puesto);
      paramIndex++;
    }

    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex}`);
      values.push(descripcion);
      paramIndex++;
    }

    if (foto !== undefined) {
      updates.push(`foto = $${paramIndex}`);
      values.push(foto);
      paramIndex++;
    }

    if (costo !== undefined) {
      updates.push(`costo = $${paramIndex}`);
      values.push(costo);
      paramIndex++;
    }

    if (correo !== undefined) {
      updates.push(`correo = $${paramIndex}`);
      values.push(correo);
      paramIndex++;
    }

    if (celular !== undefined) {
      updates.push(`celular = $${paramIndex}`);
      values.push(celular);
      paramIndex++;
    }

    if (id_fuente !== undefined) {
      updates.push(`id_fuente = $${paramIndex}`);
      values.push(id_fuente);
      paramIndex++;
    }

    if (id_paso !== undefined) {
      updates.push(`id_paso = $${paramIndex}`);
      values.push(id_paso);
      paramIndex++;
    }

    if (id_piso !== undefined) {
      updates.push(`id_piso = $${paramIndex}`);
      values.push(id_piso);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "Nada que actualizar" },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await query(
      `UPDATE miembros
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Miembro no encontrado" },
        { status: 404 }
      );
    }

    // Sync sistemas (many-to-many)
    if (sistemas_ids !== undefined) {
      await query(`DELETE FROM miembros_sistemas WHERE id_miembro = $1`, [id]);
      if (Array.isArray(sistemas_ids) && sistemas_ids.length > 0) {
        const insertValues = sistemas_ids
          .map((_: number, i: number) => `($1, $${i + 2})`)
          .join(", ");
        await query(
          `INSERT INTO miembros_sistemas (id_miembro, id_sistema) VALUES ${insertValues}`,
          [id, ...sistemas_ids]
        );
      }
    }

    return NextResponse.json({ miembro: result.rows[0] });
  } catch (error) {
    console.error("Error updating miembro:", error);
    return NextResponse.json(
      { error: "Error al actualizar miembro" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/miembros/[id] - Delete member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // First, remove the member reference from any user profiles
    await query(
      `UPDATE user_profiles SET id_miembro = NULL WHERE id_miembro = $1`,
      [id]
    );

    // Then delete the member
    const result = await query(
      `DELETE FROM miembros WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Miembro no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting miembro:", error);
    return NextResponse.json(
      { error: "Error al eliminar miembro" },
      { status: 500 }
    );
  }
}
