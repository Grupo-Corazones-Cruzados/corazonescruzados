import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/google/status - Check if Google is connected
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await query(
      "SELECT id FROM google_tokens WHERE id = $1",
      [tokenData.userId]
    );

    return NextResponse.json({ connected: result.rows.length > 0 });
  } catch (error) {
    console.error("Error checking Google status:", error);
    return NextResponse.json({ error: "Error al verificar el estado" }, { status: 500 });
  }
}

// DELETE /api/google/status - Disconnect Google
export async function DELETE() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    await query("DELETE FROM google_tokens WHERE id = $1", [tokenData.userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Google:", error);
    return NextResponse.json({ error: "Error al desconectar" }, { status: 500 });
  }
}
