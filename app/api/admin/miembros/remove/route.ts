import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/admin/miembros/remove - Remove member status
export async function POST(request: NextRequest) {
  console.log("[Remove Member] Starting request...");

  try {
    const tokenData = await getCurrentUser();
    console.log("[Remove Member] Token data:", tokenData ? "valid" : "null");

    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const userResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );
    console.log("[Remove Member] User role check:", userResult.rows[0]?.rol);

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
      console.log("[Remove Member] Request body:", body);
    } catch (parseError) {
      console.error("[Remove Member] JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Cuerpo de solicitud invalido" },
        { status: 400 }
      );
    }

    const { miembroId, keepRecord } = body;
    console.log("[Remove Member] miembroId:", miembroId, "keepRecord:", keepRecord);

    if (!miembroId) {
      return NextResponse.json(
        { error: "ID de miembro requerido" },
        { status: 400 }
      );
    }

    // Check if member exists
    console.log("[Remove Member] Checking if member exists...");
    const memberResult = await query(
      `SELECT id, nombre FROM miembros WHERE id = $1`,
      [miembroId]
    );
    console.log("[Remove Member] Member found:", memberResult.rows.length > 0);

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Miembro no encontrado" },
        { status: 404 }
      );
    }

    // Find user linked to this member
    console.log("[Remove Member] Finding linked user...");
    const linkedUserResult = await query(
      `SELECT id, email FROM user_profiles WHERE id_miembro = $1`,
      [miembroId]
    );
    console.log("[Remove Member] Linked user found:", linkedUserResult.rows.length > 0);

    let userUnlinked = false;

    // If there's a linked user, update them to remove member status
    if (linkedUserResult.rows.length > 0) {
      console.log("[Remove Member] Unlinking user from member...");
      await query(
        `UPDATE user_profiles
         SET id_miembro = NULL, rol = 'cliente'
         WHERE id_miembro = $1`,
        [miembroId]
      );
      console.log("[Remove Member] User unlinked successfully");
      userUnlinked = true;
    }

    // Delete or keep the member record
    let memberDeleted = false;
    let deleteBlocked = false;

    if (!keepRecord) {
      try {
        console.log("[Remove Member] Attempting to delete member record...");
        await query(`DELETE FROM miembros WHERE id = $1`, [miembroId]);
        memberDeleted = true;
        console.log("[Remove Member] Member deleted successfully");
      } catch (deleteError: unknown) {
        const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
        console.warn("[Remove Member] Delete error:", errorMessage);
        // If there's a foreign key constraint, just warn but continue
        if (errorMessage.includes("foreign key") || errorMessage.includes("violates") || errorMessage.includes("constraint")) {
          deleteBlocked = true;
          console.warn("[Remove Member] Cannot delete member due to constraints, keeping record");
        } else {
          throw deleteError;
        }
      }
    }

    // Build response message based on what happened
    let message = "";
    if (userUnlinked && memberDeleted) {
      message = "Usuario desvinculado y registro de miembro eliminado";
    } else if (userUnlinked && deleteBlocked) {
      message = "Usuario desvinculado. El registro del miembro se conserva porque tiene tickets o proyectos asociados.";
    } else if (userUnlinked && keepRecord) {
      message = "Usuario desvinculado del miembro";
    } else if (memberDeleted) {
      message = "Registro de miembro eliminado";
    } else if (deleteBlocked) {
      message = "No se puede eliminar el miembro porque tiene tickets o proyectos asociados. No habia usuario vinculado.";
    } else if (keepRecord && !userUnlinked) {
      message = "Este miembro no tiene usuario vinculado. El registro se conserva.";
    } else {
      message = "Operacion completada";
    }

    return NextResponse.json({
      success: userUnlinked || memberDeleted,
      warning: deleteBlocked && !userUnlinked,
      message,
      linkedUser: linkedUserResult.rows[0] || null,
    });
  } catch (error) {
    console.error("Error removing member:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `Error al remover miembro: ${errorMessage}` },
      { status: 500 }
    );
  }
}
