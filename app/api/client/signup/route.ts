import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import { sendCharacterVerificationEmail } from '@/lib/integrations/email';
import {
  CLIENT_COOKIE,
  COOKIE_MAX_AGE,
  getClientIp,
  hashIp,
  generateClientToken,
} from '@/lib/world/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registro de cuenta de CLIENTE (sin pasar por el juego). Crea directamente una
 * fila en gcc_world.clients con account_type='client' y datos pendientes
 * (pending_email/pending_password_hash) que se activan con el mismo flujo de
 * verificación por correo (/api/character/auth/verify).
 */
export async function POST(req: Request) {
  try {
    const { fullName, email, country, address, phone, password, marketing } =
      await req.json();
    const sFull = typeof fullName === 'string' ? fullName.trim() : '';
    const sEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const sCountry = typeof country === 'string' ? country.trim() : '';
    const sAddr = typeof address === 'string' ? address.trim() : '';
    const sPhone = typeof phone === 'string' ? phone.trim() : '';

    if (sFull.length < 2) return bad('Ingresa tu nombre completo');
    if (!EMAIL_RE.test(sEmail)) return bad('Correo inválido');
    if (sCountry.length < 2) return bad('Ingresa tu país');
    if (sAddr.length < 3) return bad('Ingresa tu dirección');
    if (sPhone.length < 7) return bad('Ingresa un teléfono válido');
    if (typeof password !== 'string' || password.length < 8)
      return bad('La contraseña debe tener al menos 8 caracteres');

    // Columnas de datos de cuenta (idempotente).
    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS full_name text,
         ADD COLUMN IF NOT EXISTS country text,
         ADD COLUMN IF NOT EXISTS address text,
         ADD COLUMN IF NOT EXISTS phone text,
         ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'candidate',
         ADD COLUMN IF NOT EXISTS marketing boolean DEFAULT false`,
    );

    // El correo no puede reutilizarse por una cuenta ya verificada.
    const taken = await pool.query(
      `SELECT id FROM gcc_world.clients
        WHERE LOWER(email) = $1 AND email_verified = TRUE LIMIT 1`,
      [sEmail],
    );
    if (taken.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ese correo ya está asociado a una cuenta. Inicia sesión.' },
        { status: 409 },
      );
    }

    const ipHash = hashIp(await getClientIp());
    const clientToken = generateClientToken();
    const verificationToken = randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(password);
    const placeholderEmail = `client-${clientToken}@pending.gcc-world.local`;

    await pool.query(
      `INSERT INTO gcc_world.clients
          (name, email, alias, full_name, country, address, phone, account_type, marketing,
           pending_email, pending_password_hash, verification_token, verification_expires,
           client_token, ip_hash, last_seen_at)
       VALUES ($1, $2, $1, $1, $3, $4, $5, 'client', $6,
               $7, $8, $9, NOW() + INTERVAL '24 hours',
               $10, $11, NOW())`,
      [
        sFull,
        placeholderEmail,
        sCountry,
        sAddr,
        sPhone,
        marketing === true,
        sEmail,
        passwordHash,
        verificationToken,
        clientToken,
        ipHash,
      ],
    );

    const cookieStore = await cookies();
    cookieStore.set(CLIENT_COOKIE, clientToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    try {
      await sendCharacterVerificationEmail(sEmail, verificationToken, sFull);
    } catch (err) {
      console.error('Client verification email failed:', err);
      return NextResponse.json(
        { error: 'No pudimos enviar el correo. Verifica que la dirección sea correcta.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, email: sEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Client signup error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
