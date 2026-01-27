import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createToken, setAuthCookie } from "@/lib/auth/jwt";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token de verificacion requerido" },
        { status: 400 }
      );
    }

    // Find verification token
    const tokenResult = await query(
      `SELECT vt.*, up.email, up.nombre, up.apellido, up.rol
       FROM verification_tokens vt
       JOIN user_profiles up ON up.id = vt.user_id
       WHERE vt.token = $1 AND vt.type = 'email_verification'`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Token invalido o expirado" },
        { status: 400 }
      );
    }

    const verificationToken = tokenResult.rows[0];

    // Check if token is expired
    if (new Date(verificationToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "El token ha expirado. Solicita un nuevo correo de verificacion." },
        { status: 400 }
      );
    }

    // Check if token was already used
    if (verificationToken.used_at) {
      return NextResponse.json(
        { error: "Este enlace ya fue utilizado" },
        { status: 400 }
      );
    }

    // Mark user as verified
    await query(
      `UPDATE user_profiles SET verificado = true WHERE id = $1`,
      [verificationToken.user_id]
    );

    // Mark token as used
    await query(
      `UPDATE verification_tokens SET used_at = NOW() WHERE id = $1`,
      [verificationToken.id]
    );

    // Create JWT token and log the user in
    const jwtToken = await createToken({
      userId: verificationToken.user_id,
      email: verificationToken.email,
    });
    await setAuthCookie(jwtToken);

    return NextResponse.json({
      success: true,
      message: "Cuenta verificada correctamente",
      user: {
        id: verificationToken.user_id,
        email: verificationToken.email,
        nombre: verificationToken.nombre,
        apellido: verificationToken.apellido,
        rol: verificationToken.rol,
        verificado: true,
      },
    });
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json(
      { error: "Error al verificar la cuenta" },
      { status: 500 }
    );
  }
}

// POST endpoint for resending verification email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email requerido" },
        { status: 400 }
      );
    }

    // Find user
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

    // Generate new verification token
    const crypto = await import("crypto");
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete old tokens and create new one
    await query(`DELETE FROM verification_tokens WHERE user_id = $1 AND type = 'email_verification'`, [user.id]);
    await query(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at)
       VALUES ($1, $2, 'email_verification', $3)`,
      [user.id, verificationToken, expiresAt]
    );

    // Send verification email
    const { sendVerificationEmail } = await import("@/lib/email");
    await sendVerificationEmail(user.email, verificationToken, user.nombre);

    return NextResponse.json({
      success: true,
      message: "Correo de verificación enviado",
    });
  } catch (error) {
    console.error("Error resending verification:", error);
    return NextResponse.json(
      { error: "Error al enviar el correo" },
      { status: 500 }
    );
  }
}
