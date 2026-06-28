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
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

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

    // "Ya tengo una cuenta" es SOLO para candidatos. Si el correo pertenece a
    // un miembro/admin (staff), se rechaza: deben usar "Ingresar como miembro".
    const memberCheck = await pool.query(
      `SELECT 1 FROM gcc_world.users
        WHERE LOWER(email) = $1 AND role IN ('member','admin') LIMIT 1`,
      [cleanEmail],
    );
    if (memberCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'Esta es una cuenta de miembro. Usa "Ingresar como miembro".' },
        { status: 403 },
      );
    }

    const r = await pool.query(
      `SELECT id, alias, password_hash, email_verified, email
         FROM gcc_world.clients
        WHERE LOWER(email) = $1
        LIMIT 1`,
      [cleanEmail],
    );
    const row = r.rows[0];
    if (!row || !row.password_hash) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 },
      );
    }
    if (!row.email_verified) {
      return NextResponse.json(
        { error: 'La cuenta aún no está confirmada' },
        { status: 403 },
      );
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 },
      );
    }

    // validateOnly: solo confirma las credenciales (paso 1) sin enviar el código.
    if (validateOnly) {
      return NextResponse.json({ ok: true, masked: maskEmail(row.email) });
    }

    const code = generateCode();
    await pool.query(
      `UPDATE gcc_world.clients
          SET recovery_code = $1,
              recovery_code_exp = NOW() + INTERVAL '15 minutes'
        WHERE id = $2`,
      [code, row.id],
    );

    try {
      await sendCharacterRecoveryCodeEmail(
        row.email,
        code,
        row.alias || 'Jugador',
      );
    } catch (e) {
      console.error('Recovery email send failed:', e);
      return NextResponse.json(
        { error: 'No se pudo enviar el correo' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, masked: maskEmail(row.email) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Recovery begin error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
