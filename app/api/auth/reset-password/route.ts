import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/integrations/resend";

export async function POST(req: NextRequest) {
  try {
    const { email, token, password } = await req.json();

    // Step 1: Request reset (email only)
    if (email && !token) {
      const result = await pool.query(
        "SELECT id, first_name FROM gcc_world.users WHERE email = $1",
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
        });
      }

      const user = result.rows[0];
      const resetToken = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        "UPDATE gcc_world.users SET reset_token = $1, reset_token_exp = $2 WHERE id = $3",
        [resetToken, expires, user.id]
      );

      await sendPasswordResetEmail(
        email,
        resetToken,
        user.first_name || undefined
      );

      return NextResponse.json({
        message: "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
      });
    }

    // Step 2: Reset password (token + new password)
    if (token && password) {
      if (password.length < 8) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 8 caracteres" },
          { status: 400 }
        );
      }

      const result = await pool.query(
        "SELECT id FROM gcc_world.users WHERE reset_token = $1 AND reset_token_exp > NOW()",
        [token]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: "Token inválido o expirado" },
          { status: 400 }
        );
      }

      const hash = await hashPassword(password);
      await pool.query(
        "UPDATE gcc_world.users SET password_hash = $1, reset_token = NULL, reset_token_exp = NULL WHERE id = $2",
        [hash, result.rows[0].id]
      );

      return NextResponse.json({
        message: "Contraseña actualizada exitosamente",
      });
    }

    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Error al procesar solicitud" },
      { status: 500 }
    );
  }
}
