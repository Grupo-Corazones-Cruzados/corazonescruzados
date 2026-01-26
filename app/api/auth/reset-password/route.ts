import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    // Check if user exists
    const result = await query(
      "SELECT id, nombre FROM user_profiles WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      // Don't reveal if user exists or not
      return NextResponse.json({
        success: true,
        message: "Si el email existe, recibirás instrucciones para restablecer tu contraseña",
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await query(
      `UPDATE user_profiles
       SET reset_token = $1, reset_token_expires = $2
       WHERE id = $3`,
      [resetToken, expiresAt.toISOString(), user.id]
    );

    // Send email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/reset?token=${resetToken}`;

    const resend = getResend();
    if (resend) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Corazones Cruzados <lfgonzalezm0@grupocc.org>",
        to: email,
        subject: "Restablecer tu contraseña",
        html: `
          <h2>Hola ${user.nombre || ""}!</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4A90A4; color: white; text-decoration: none; border-radius: 6px;">
            Restablecer Contraseña
          </a>
          <p style="margin-top: 20px; color: #666;">Este enlace expirará en 1 hora.</p>
          <p style="color: #666;">Si no solicitaste este cambio, puedes ignorar este email.</p>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Si el email existe, recibirás instrucciones para restablecer tu contraseña",
    });
  } catch (error) {
    console.error("Error en reset password:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

// Confirm password reset
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token y nueva contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Find user with valid token
    const result = await query(
      `SELECT id FROM user_profiles
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Token inválido o expirado" },
        { status: 400 }
      );
    }

    const { hashPassword } = await import("@/lib/auth/password");
    const passwordHash = await hashPassword(password);

    // Update password and clear token
    await query(
      `UPDATE user_profiles
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, result.rows[0].id]
    );

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error confirmando reset:", error);
    return NextResponse.json(
      { error: "Error al restablecer la contraseña" },
      { status: 500 }
    );
  }
}
