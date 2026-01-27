import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // Check if user is logged in
    const tokenData = await getCurrentUser();

    let email: string;
    let userId: string;
    let nombre: string | null = null;

    if (tokenData) {
      // User is logged in, get their info
      const userResult = await query(
        `SELECT id, email, nombre, verificado FROM user_profiles WHERE id = $1`,
        [tokenData.userId]
      );

      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Usuario no encontrado" },
          { status: 404 }
        );
      }

      const user = userResult.rows[0];

      if (user.verificado) {
        return NextResponse.json({
          success: true,
          message: "Tu cuenta ya está verificada",
          alreadyVerified: true,
        });
      }

      email = user.email;
      userId = user.id;
      nombre = user.nombre;
    } else {
      // User not logged in, get email from request body
      const body = await request.json();
      email = body.email;

      if (!email) {
        return NextResponse.json(
          { error: "Email requerido" },
          { status: 400 }
        );
      }

      // Find user by email
      const userResult = await query(
        `SELECT id, email, nombre, verificado FROM user_profiles WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if email exists
        return NextResponse.json({
          success: true,
          message: "Si el correo existe, recibirás un enlace de verificación",
        });
      }

      const user = userResult.rows[0];

      if (user.verificado) {
        return NextResponse.json({
          success: true,
          message: "Esta cuenta ya está verificada",
          alreadyVerified: true,
        });
      }

      userId = user.id;
      nombre = user.nombre;
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete old tokens and create new one
    await query(
      `DELETE FROM verification_tokens WHERE user_id = $1 AND type = 'email_verification'`,
      [userId]
    );

    await query(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at)
       VALUES ($1, $2, 'email_verification', $3)`,
      [userId, verificationToken, expiresAt]
    );

    // Send verification email
    const result = await sendVerificationEmail(email, verificationToken, nombre || undefined);

    if (!result.success) {
      console.error("Failed to send verification email:", result.error);
      return NextResponse.json(
        { error: "Error al enviar el correo. Intenta de nuevo." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Correo de verificación enviado. Revisa tu bandeja de entrada.",
    });
  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json(
      { error: "Error al enviar el correo" },
      { status: 500 }
    );
  }
}
