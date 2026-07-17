import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/integrations/email";
import { getClientIp, hashIp } from "@/lib/world/session";

const CLIENT_REF_COOKIE = "gcc_client_ref";

export async function POST(req: NextRequest) {
  try {
    const { email, password, first_name, last_name, phone, country, address } =
      await req.json();

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

    // Columnas opcionales de datos de cliente (idempotente). ref_token/ip_hash
    // sirven para reconocer al cliente (cookie/IP) y su estado de verificación.
    await pool.query(
      `ALTER TABLE gcc_world.users
         ADD COLUMN IF NOT EXISTS country text,
         ADD COLUMN IF NOT EXISTS address text,
         ADD COLUMN IF NOT EXISTS ref_token text,
         ADD COLUMN IF NOT EXISTS ip_hash text`
    );

    const cookieStore = await cookies();
    const existingRef = cookieStore.get(CLIENT_REF_COOKIE)?.value || null;
    const ipHash = hashIp(await getClientIp());

    // Una sola cuenta de cliente por dispositivo: si ya hay una (por cookie o IP),
    // no se permite crear otra (verificada o no).
    const deviceClient = await pool.query(
      `SELECT 1 FROM gcc_world.users
        WHERE role = 'client' AND (($1::text IS NOT NULL AND ref_token = $1) OR ip_hash = $2)
        LIMIT 1`,
      [existingRef, ipHash],
    );
    if (deviceClient.rows.length > 0) {
      return NextResponse.json(
        {
          error:
            "Ya tienes una cuenta de cliente en este dispositivo. Verifica tu correo o inicia sesión.",
        },
        { status: 409 }
      );
    }

    // Reutiliza la cookie de dispositivo si ya existe (igual que la postulación
    // de candidato), o genera una nueva.
    const refToken = existingRef || randomBytes(24).toString("hex");

    const result = await pool.query(
      `INSERT INTO gcc_world.users (email, password_hash, first_name, last_name, role, phone, country, address, ref_token, ip_hash)
       VALUES ($1, $2, $3, $4, 'client', $5, $6, $7, $8, $9)
       RETURNING id, email, first_name, last_name, role`,
      [
        email.toLowerCase(),
        hash,
        first_name || null,
        last_name || null,
        phone || null,
        country || null,
        address || null,
        refToken,
        ipHash,
      ]
    );
    const user = result.rows[0];

    // Cookie de reconocimiento (1 año): reconoce al cliente aunque cambie la IP.
    cookieStore.set(CLIENT_REF_COOKIE, refToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

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
