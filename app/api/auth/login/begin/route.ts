import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
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
 * Paso 1 del login de usuario (cliente/staff) con 2FA: valida credenciales
 * contra gcc_world.users y envía un código por correo. Paso 2: /api/auth/login/verify.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    const r = await pool.query(
      `SELECT id, password_hash, is_verified, first_name FROM gcc_world.users
        WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    const user = r.rows[0];
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    if (!user.is_verified) {
      return NextResponse.json(
        { error: 'Debes verificar tu correo electrónico antes de iniciar sesión.' },
        { status: 403 },
      );
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
      await sendCharacterRecoveryCodeEmail(cleanEmail, code, user.first_name || 'Usuario');
    } catch (e) {
      console.error('Login code email failed:', e);
      return NextResponse.json({ error: 'No se pudo enviar el código' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, masked: maskEmail(cleanEmail) });
  } catch (error) {
    console.error('Login begin error:', error);
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}
