import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyPassword } from '@/lib/auth/password';
import { sendCharacterRecoveryCodeEmail } from '@/lib/integrations/email';
import { CLIENT_COOKIE } from '@/lib/world/session';

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
 * Login para CONTINUAR LA PARTIDA (jugador recurrente) — paso 1, unificado:
 * valida credenciales y envía un código (2FA). Funciona tanto para MIEMBRO/ADMIN
 * (contra gcc_world.users) como para CANDIDATO (contra su personaje en
 * gcc_world.clients). El paso 2 es /returning/verify.
 */
export async function POST(req: Request) {
  try {
    const { email, password, expect, validateOnly, recognized } =
      await req.json();
    if (typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Correo requerido' },
        { status: 400 },
      );
    }
    const cleanEmail = email.trim().toLowerCase();
    const code = generateCode();
    const pwd = typeof password === 'string' ? password : '';

    // Flujo "reconocido": si el DISPOSITIVO (cookie de cliente) está enlazado a
    // este correo (por clients.email o por su usuario staff), se puede enviar el
    // código SIN contraseña (la posesión del correo / la passkey es el factor).
    let deviceRecognized = false;
    if (recognized === true) {
      try {
        const token = (await cookies()).get(CLIENT_COOKIE)?.value;
        if (token) {
          const cr = await pool.query(
            `SELECT LOWER(c.email) AS cemail, LOWER(u.email) AS uemail
               FROM gcc_world.clients c
               LEFT JOIN gcc_world.users u ON u.id = c.user_id
              WHERE c.client_token = $1 LIMIT 1`,
            [token],
          );
          const crow = cr.rows[0];
          if (crow && (crow.cemail === cleanEmail || crow.uemail === cleanEmail)) {
            deviceRecognized = true;
          }
        }
      } catch {
        /* sin reconocimiento → cae al flujo con contraseña */
      }
    }
    if (!deviceRecognized && typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Correo y contraseña son requeridos' },
        { status: 400 },
      );
    }

    // ¿Tiene cuenta en gcc_world.users? (miembro/admin o CLIENTE). Valida ahí.
    const u = await pool.query(
      `SELECT id, password_hash, first_name, role, is_verified FROM gcc_world.users
        WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    const account = u.rows[0];
    const accountKind: 'member' | 'client' | null = account
      ? account.role === 'member' || account.role === 'admin'
        ? 'member'
        : 'client'
      : null;

    // Restricción por tipo reconocido: el modal solo acepta el tipo con el que se
    // reconoció la cuenta. Para usar otro tipo, "Cambiar tipo de ingreso".
    if (expect && accountKind && expect !== accountKind) {
      return NextResponse.json(
        { error: `Esta cuenta es de tipo ${accountKind}. Usa "Cambiar tipo de ingreso".` },
        { status: 403 },
      );
    }
    if (expect === 'candidate' && account) {
      return NextResponse.json(
        { error: 'Esta no es una cuenta de candidato. Usa "Cambiar tipo de ingreso".' },
        { status: 403 },
      );
    }
    if ((expect === 'member' || expect === 'client') && !account) {
      return NextResponse.json(
        { error: 'No es una cuenta registrada. Usa "Cambiar tipo de ingreso".' },
        { status: 403 },
      );
    }

    if (account && expect !== 'candidate') {
      if (
        !deviceRecognized &&
        (!account.password_hash || !(await verifyPassword(pwd, account.password_hash)))
      ) {
        return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
      }
      // El cliente debe verificar su correo antes de poder ingresar.
      if (accountKind === 'client' && !account.is_verified) {
        return NextResponse.json(
          { error: 'Debes verificar tu correo electrónico antes de ingresar.' },
          { status: 403 },
        );
      }
      if (validateOnly) {
        return NextResponse.json({ ok: true, kind: accountKind, masked: maskEmail(cleanEmail) });
      }
      await pool.query(
        `ALTER TABLE gcc_world.users
           ADD COLUMN IF NOT EXISTS login_code text,
           ADD COLUMN IF NOT EXISTS login_code_exp timestamptz`,
      );
      await pool.query(
        `UPDATE gcc_world.users SET login_code = $1, login_code_exp = NOW() + INTERVAL '15 minutes' WHERE id = $2`,
        [code, account.id],
      );
      try {
        await sendCharacterRecoveryCodeEmail(
          cleanEmail,
          code,
          account.first_name || (accountKind === 'client' ? 'Cliente' : 'Miembro'),
        );
      } catch (e) {
        console.error('Returning account code email failed:', e);
        return NextResponse.json({ error: 'No se pudo enviar el código' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, kind: accountKind, masked: maskEmail(cleanEmail) });
    }

    // Si no, valida contra el personaje (candidato).
    const r = await pool.query(
      `SELECT id, alias, password_hash, email_verified FROM gcc_world.clients
        WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    const row = r.rows[0];
    if (!row || !row.password_hash) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }
    if (!row.email_verified) {
      return NextResponse.json({ error: 'La cuenta aún no está confirmada' }, { status: 403 });
    }
    if (!deviceRecognized && !(await verifyPassword(pwd, row.password_hash))) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
    }
    if (validateOnly) {
      return NextResponse.json({ ok: true, kind: 'candidate', masked: maskEmail(cleanEmail) });
    }
    await pool.query(
      `UPDATE gcc_world.clients SET recovery_code = $1, recovery_code_exp = NOW() + INTERVAL '15 minutes' WHERE id = $2`,
      [code, row.id],
    );
    try {
      await sendCharacterRecoveryCodeEmail(cleanEmail, code, row.alias || 'Jugador');
    } catch (e) {
      console.error('Returning candidate code email failed:', e);
      return NextResponse.json({ error: 'No se pudo enviar el código' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, kind: 'candidate', masked: maskEmail(cleanEmail) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Returning begin error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
