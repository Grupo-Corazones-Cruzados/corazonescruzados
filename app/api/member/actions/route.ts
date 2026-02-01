import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// Helper to get member info for current user
async function getMemberInfo(userId: string) {
  try {
    const result = await query(
      `SELECT m.id, m.nombre, m.id_fuente, f.nombre as fuente_nombre
       FROM user_profiles up
       JOIN miembros m ON up.id_miembro = m.id
       LEFT JOIN fuentes f ON m.id_fuente = f.id
       WHERE up.id = $1 AND up.rol IN ('miembro', 'admin')`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error in getMemberInfo:", error);
    return null;
  }
}

// GET /api/member/actions - Get actions for the member's source
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Step 1: Get user profile
    let userProfile;
    try {
      const userResult = await query(
        `SELECT id, rol, id_miembro FROM user_profiles WHERE id = $1`,
        [tokenData.userId]
      );
      userProfile = userResult.rows[0];
    } catch (e) {
      console.error("Error getting user profile:", e);
      return NextResponse.json({ error: "Error al obtener perfil", details: String(e) }, { status: 500 });
    }

    if (!userProfile || (userProfile.rol !== "miembro" && userProfile.rol !== "admin")) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    if (!userProfile.id_miembro) {
      return NextResponse.json({ error: "No tienes un registro de miembro vinculado" }, { status: 403 });
    }

    // Step 2: Get member info
    let memberInfo;
    try {
      const memberResult = await query(
        `SELECT m.id, m.nombre, m.id_fuente, f.nombre as fuente_nombre
         FROM miembros m
         LEFT JOIN fuentes f ON m.id_fuente = f.id
         WHERE m.id = $1`,
        [userProfile.id_miembro]
      );
      memberInfo = memberResult.rows[0];
    } catch (e) {
      console.error("Error getting member info:", e);
      return NextResponse.json({ error: "Error al obtener info de miembro", details: String(e) }, { status: 500 });
    }

    if (!memberInfo) {
      return NextResponse.json({ error: "Registro de miembro no encontrado" }, { status: 404 });
    }

    if (!memberInfo.id_fuente) {
      return NextResponse.json({
        error: "No tienes una fuente asignada. Contacta al administrador.",
        actions: [],
        myActions: [],
        availableActions: [],
        memberInfo
      }, { status: 200 });
    }

    // Step 3: Get actions
    let actions = [];
    try {
      const { searchParams } = new URL(request.url);
      const filter = searchParams.get("filter") || "all";

      let sql = `
        SELECT a.id, a.nombre, a.id_miembro, a.id_fuente,
               m.nombre as miembro_nombre
        FROM acciones a
        LEFT JOIN miembros m ON a.id_miembro = m.id
        WHERE a.id_fuente = $1
      `;
      const params: any[] = [memberInfo.id_fuente];

      if (filter === "mine") {
        sql += ` AND a.id_miembro = $2`;
        params.push(memberInfo.id);
      } else if (filter === "available") {
        sql += ` AND (a.id_miembro IS NULL OR a.id_miembro = $2)`;
        params.push(memberInfo.id);
      }

      sql += ` ORDER BY a.nombre ASC`;

      const result = await query(sql, params);
      actions = result.rows;
    } catch (e) {
      console.error("Error getting actions:", e);
      return NextResponse.json({ error: "Error al obtener acciones", details: String(e) }, { status: 500 });
    }

    // Separate into my actions and available actions
    const myActions = actions.filter((a: any) => a.id_miembro === memberInfo.id);
    const availableActions = actions.filter((a: any) => a.id_miembro === null);

    return NextResponse.json({
      actions,
      myActions,
      availableActions,
      memberInfo: {
        id: memberInfo.id,
        nombre: memberInfo.nombre,
        id_fuente: memberInfo.id_fuente,
        fuente_nombre: memberInfo.fuente_nombre
      }
    });
  } catch (error) {
    console.error("Error fetching member actions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      error: "Error al cargar las acciones",
      details: errorMessage
    }, { status: 500 });
  }
}

// POST /api/member/actions - Create a new action for the member's source
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const memberInfo = await getMemberInfo(tokenData.userId);
    if (!memberInfo) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    if (!memberInfo.id_fuente) {
      return NextResponse.json({ error: "No tienes una fuente asignada" }, { status: 400 });
    }

    const body = await request.json();
    const { nombre, assignToMe } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    // Create the action
    const result = await query(
      `INSERT INTO acciones (nombre, id_fuente, id_miembro)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        nombre.trim(),
        memberInfo.id_fuente,
        assignToMe ? memberInfo.id : null
      ]
    );

    return NextResponse.json({
      success: true,
      action: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating action:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Error al crear la accion", details: errorMessage }, { status: 500 });
  }
}

// PATCH /api/member/actions - Assign or unassign an action
export async function PATCH(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const memberInfo = await getMemberInfo(tokenData.userId);
    if (!memberInfo) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const body = await request.json();
    const { actionId, assign, nombre } = body;

    if (!actionId) {
      return NextResponse.json({ error: "ID de accion requerido" }, { status: 400 });
    }

    // Verify action belongs to member's source
    const actionCheck = await query(
      `SELECT id, id_fuente, id_miembro FROM acciones WHERE id = $1`,
      [actionId]
    );

    if (actionCheck.rows.length === 0) {
      return NextResponse.json({ error: "Accion no encontrada" }, { status: 404 });
    }

    const action = actionCheck.rows[0];
    if (action.id_fuente !== memberInfo.id_fuente) {
      return NextResponse.json({ error: "Esta accion no pertenece a tu area" }, { status: 403 });
    }

    // Rename action
    if (nombre !== undefined) {
      if (!nombre.trim()) {
        return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
      }

      const result = await query(
        `UPDATE acciones SET nombre = $1 WHERE id = $2 RETURNING *`,
        [nombre.trim(), actionId]
      );

      return NextResponse.json({
        success: true,
        action: result.rows[0]
      });
    }

    // If assigning, check if it's already assigned to someone else
    if (assign && action.id_miembro && action.id_miembro !== memberInfo.id) {
      return NextResponse.json({ error: "Esta accion ya esta asignada a otro miembro" }, { status: 400 });
    }

    // Update the action assignment
    const result = await query(
      `UPDATE acciones SET id_miembro = $1 WHERE id = $2 RETURNING *`,
      [assign ? memberInfo.id : null, actionId]
    );

    return NextResponse.json({
      success: true,
      action: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating action:", error);
    return NextResponse.json({ error: "Error al actualizar la accion" }, { status: 500 });
  }
}

// DELETE /api/member/actions - Delete an action (only if created by member and not used)
export async function DELETE(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const memberInfo = await getMemberInfo(tokenData.userId);
    if (!memberInfo) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get("id");

    if (!actionId) {
      return NextResponse.json({ error: "ID de accion requerido" }, { status: 400 });
    }

    // Verify action belongs to member's source and is assigned to them (they can only delete their own)
    const actionCheck = await query(
      `SELECT id, id_fuente, id_miembro FROM acciones WHERE id = $1`,
      [actionId]
    );

    if (actionCheck.rows.length === 0) {
      return NextResponse.json({ error: "Accion no encontrada" }, { status: 404 });
    }

    const action = actionCheck.rows[0];
    if (action.id_fuente !== memberInfo.id_fuente) {
      return NextResponse.json({ error: "Esta accion no pertenece a tu area" }, { status: 403 });
    }

    // Only allow deletion if the action is assigned to them or unassigned
    if (action.id_miembro && action.id_miembro !== memberInfo.id) {
      return NextResponse.json({ error: "No puedes eliminar acciones de otros miembros" }, { status: 403 });
    }

    // Delete the action
    await query(`DELETE FROM acciones WHERE id = $1`, [actionId]);

    return NextResponse.json({
      success: true,
      message: "Accion eliminada"
    });
  } catch (error) {
    console.error("Error deleting action:", error);
    const errorMessage = error instanceof Error ? error.message : "";
    if (errorMessage.includes("foreign key") || errorMessage.includes("violates")) {
      return NextResponse.json(
        { error: "No se puede eliminar: esta accion esta siendo usada" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Error al eliminar la accion" }, { status: 500 });
  }
}
