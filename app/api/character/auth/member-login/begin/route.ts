import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { sendCharacterRecoveryCodeEmail } from '@/lib/integrations/resend';

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}
function generateCode(): string {
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
}

/**
 * Paso 1 del login de MIEMBRO/ADMIN para entrar al juego: valida credenciales
 * contra gcc_world.users (member/admin) y envía un código de verificación al
 * correo (2FA). El paso 2 es /member-login/verify.
 */
export async function POST(req: Request) {
  try {
    const { email, password, validateOnly } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Correo y contraseña son requeridos' },
        { status: 400 },
      );
    }
    const cleanEmail = email.trim().toLowerCase();

    const u = await pool.query(
      `SELECT id, password_hash, first_name FROM gcc_world.users
        WHERE LOWER(email) = $1 AND role IN ('member','admin') LIMIT 1`,
      [cleanEmail],
    );
    const user = u.rows[0];
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: 'No es una cuenta de miembro o credenciales inválidas' },
        { status: 401 },
      );
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }

    // validateOnly: solo confirma las credenciales (paso 1) sin enviar el código.
    if (validateOnly) {
      return NextResponse.json({ ok: true, masked: maskEmail(cleanEmail) });
    }

    await pool.query(
      `ALTER TABLE gcc_world.users
         ADD COLUMN IF NOT EXISTS login_code text,
         ADD COLUMN IF NOT EXISTS login_code_exp timestamptz`,
    );
    const code = generateCode();
    await pool.query(
      `UPDATE gcc_world.users
          SET login_code = $1, login_code_exp = NOW() + INTERVAL '15 minutes'
        WHERE id = $2`,
      [code, user.id],
    );

    try {
      await sendCharacterRecoveryCodeEmail(cleanEmail, code, user.first_name || 'Miembro');
    } catch (e) {
      console.error('Member login code email failed:', e);
      return NextResponse.json({ error: 'No se pudo enviar el código' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, masked: maskEmail(cleanEmail) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Member login begin error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
