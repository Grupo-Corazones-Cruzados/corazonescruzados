import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, nombre, apellido } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await query(
      "SELECT id FROM user_profiles WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user profile (verificado = false, requires email verification)
    const result = await query(
      `INSERT INTO user_profiles (id, email, password_hash, nombre, apellido, rol, verificado)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'cliente', false)
       RETURNING id, email, nombre, apellido, rol, verificado`,
      [email.toLowerCase(), passwordHash, nombre || null, apellido || null]
    );

    const user = result.rows[0];

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Save verification token
    await query(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at)
       VALUES ($1, $2, 'email_verification', $3)`,
      [user.id, verificationToken, expiresAt]
    );

    // Send verification email
    const emailResult = await sendVerificationEmail(
      user.email,
      verificationToken,
      user.nombre
    );

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
    }

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      message: "Cuenta creada. Revisa tu correo para verificar tu cuenta.",
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        rol: user.rol,
        verificado: user.verificado,
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json(
      { error: "Error al crear la cuenta" },
      { status: 500 }
    );
  }
}
