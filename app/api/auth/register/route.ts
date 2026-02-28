import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/integrations/resend";
import { randomHex } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { email, password, first_name, last_name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Check existing user
    const existing = await query("SELECT id FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Este correo ya está registrado" },
        { status: 409 }
      );
    }

    const hash = await hashPassword(password);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, 'client')
       RETURNING id, email, first_name, last_name, role`,
      [email.toLowerCase(), hash, first_name || null, last_name || null]
    );
    const user = result.rows[0];

    // Create verification token
    const token = randomHex(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await query(
      `INSERT INTO verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    // Send verification email
    await sendVerificationEmail(
      email,
      token,
      first_name || undefined
    );

    return NextResponse.json({
      message: "Cuenta creada. Revisa tu correo para verificar.",
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Error al registrar usuario" },
      { status: 500 }
    );
  }
}
