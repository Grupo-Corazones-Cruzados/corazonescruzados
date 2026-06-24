import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import { sendCharacterVerificationEmail } from '@/lib/integrations/resend';
import { CLIENT_COOKIE, getClientIp, hashIp } from '@/lib/world/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, password, fullName, country, address, phone, accountType } =
      await req.json();
    const sFullName = typeof fullName === 'string' ? fullName.trim() : '';
    const sCountry = typeof country === 'string' ? country.trim() : '';
    const sAddress = typeof address === 'string' ? address.trim() : '';
    const sPhone = typeof phone === 'string' ? phone.trim() : '';
    const sAccountType = accountType === 'client' ? 'client' : 'candidate';

    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json(
        { error: 'Correo inválido' },
        { status: 400 },
      );
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    let row: { id: number; alias: string | null } | null = null;
    if (token) {
      const r = await pool.query(
        `SELECT id, alias FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      row = r.rows[0] ?? null;
    }
    if (!row) {
      const r = await pool.query(
        `SELECT id, alias FROM gcc_world.clients
          WHERE ip_hash = $1 AND character_data IS NOT NULL
          ORDER BY last_seen_at DESC NULLS LAST
          LIMIT 1`,
        [ipHash],
      );
      row = r.rows[0] ?? null;
    }

    if (!row) {
      return NextResponse.json(
        { error: 'No se encontró el personaje. Crea uno primero.' },
        { status: 404 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Reject email already used by a different verified account.
    const taken = await pool.query(
      `SELECT id FROM gcc_world.clients
        WHERE LOWER(email) = $1
          AND email_verified = TRUE
          AND id <> $2
        LIMIT 1`,
      [cleanEmail, row.id],
    );
    if (taken.rows.length > 0) {
      return NextResponse.json(
        {
          error:
            'Ese correo ya está asociado a otra cuenta. Usa "Ya tengo una cuenta" para entrar.',
        },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const verificationToken = randomBytes(32).toString('hex');

    // Columnas de datos de cuenta (idempotente). account_type distingue
    // 'candidate' (postulante al proyecto) de 'client' (adquiere productos/servicios).
    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS full_name text,
         ADD COLUMN IF NOT EXISTS country text,
         ADD COLUMN IF NOT EXISTS address text,
         ADD COLUMN IF NOT EXISTS phone text,
         ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'candidate'`,
    );

    await pool.query(
      `UPDATE gcc_world.clients
          SET pending_email = $1,
              pending_password_hash = $2,
              verification_token = $3,
              verification_expires = NOW() + INTERVAL '24 hours',
              full_name = COALESCE(NULLIF($5, ''), full_name),
              country = COALESCE(NULLIF($6, ''), country),
              address = COALESCE(NULLIF($7, ''), address),
              phone = COALESCE(NULLIF($8, ''), phone),
              account_type = $9
        WHERE id = $4`,
      [
        cleanEmail,
        passwordHash,
        verificationToken,
        row.id,
        sFullName,
        sCountry,
        sAddress,
        sPhone,
        sAccountType,
      ],
    );

    try {
      await sendCharacterVerificationEmail(
        cleanEmail,
        verificationToken,
        row.alias || 'Jugador',
      );
    } catch (err) {
      console.error('Verification email send failed:', err);
      return NextResponse.json(
        {
          error:
            'No pudimos enviar el correo. Verifica que la dirección sea correcta.',
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, email: cleanEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Character signup error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
