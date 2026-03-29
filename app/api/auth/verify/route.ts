import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { createToken, setAuthCookie } from "@/lib/auth/jwt";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT vt.id, vt.user_id, vt.expires_at, vt.used_at,
            u.email, u.role
     FROM gcc_world.verification_tokens vt
     JOIN gcc_world.users u ON u.id = vt.user_id
     WHERE vt.token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  const row = result.rows[0];

  if (row.used_at) {
    return NextResponse.json(
      { error: "Este token ya fue utilizado" },
      { status: 400 }
    );
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "El token ha expirado" },
      { status: 400 }
    );
  }

  await pool.query("UPDATE gcc_world.users SET is_verified = true WHERE id = $1", [
    row.user_id,
  ]);
  await pool.query(
    "UPDATE gcc_world.verification_tokens SET used_at = NOW() WHERE id = $1",
    [row.id]
  );

  const jwt = await createToken({
    userId: row.user_id,
    email: row.email,
    role: row.role,
  });
  await setAuthCookie(jwt);

  return NextResponse.json({
    message: "Cuenta verificada exitosamente",
    verified: true,
  });
}
