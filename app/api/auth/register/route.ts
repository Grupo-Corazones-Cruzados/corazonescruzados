import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/integrations/resend";

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

    const existing = await pool.query(
      "SELECT id FROM gcc_world.users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Este correo ya está registrado" },
        { status: 409 }
      );
    }

    const hash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO gcc_world.users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, 'client')
       RETURNING id, email, first_name, last_name, role`,
      [email.toLowerCase(), hash, first_name || null, last_name || null]
    );
    const user = result.rows[0];

    const clientName = [first_name, last_name].filter(Boolean).join(" ");
    if (clientName) {
      await pool.query(
        `UPDATE gcc_world.clients SET name = $1
         WHERE LOWER(email) = LOWER($2) AND name = email`,
        [clientName, email.toLowerCase()]
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO gcc_world.verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    await sendVerificationEmail(email, token, first_name || undefined);

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
