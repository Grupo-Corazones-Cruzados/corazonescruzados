import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { sendCharacterRecoveryCodeEmail } from '@/lib/integrations/email';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';
import { PERFILES, cuentaEncaja, esTipoValido } from '@/lib/auth/tipos';

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
    const { email, password, expect, validateOnly } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }
    const cleanEmail = String(email).trim().toLowerCase();

    const r = await pool.query(
      `SELECT id, email, password_hash, is_verified, first_name, role, sin_doble_factor
         FROM gcc_world.users WHERE LOWER(email) = $1 LIMIT 1`,
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
    /**
     * ── CADA PUERTA ACEPTA SU TIPO ────────────────────────────────────────────
     * `expect` dice por qué pantalla se está entrando: `cliente`, `miembro` o `candidato`.
     *
     * ⚠️ NO BASTA CON EL ROL. Cliente y candidato comparten `role = 'client'`; lo que los
     * separa es `clients.account_type`. La comprobación anterior solo miraba el rol, así
     * que un candidato entraba por la puerta de clientes sin que nada se quejara.
     *
     * `expect: 'client'` se sigue aceptando como sinónimo de `cliente`: lo usa el modal de
     * la portada, que es anterior a esto.
     */
    const tipoEsperado = expect === 'client' ? 'cliente' : expect;
    if (esTipoValido(tipoEsperado)) {
      const { rows: [ficha] } = await pool.query(
        `SELECT account_type FROM gcc_world.clients WHERE LOWER(email) = $1
          ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
        [cleanEmail],
      );
      if (!cuentaEncaja(tipoEsperado, { role: user.role, accountType: ficha?.account_type })) {
        return NextResponse.json(
          { error: PERFILES[tipoEsperado].mensajeTipoIncorrecto },
          { status: 403 },
        );
      }
    }

    /**
     * ── CUENTAS EXENTAS DEL CÓDIGO ───────────────────────────────────────────
     * El código va al correo de la cuenta, lo que deja fuera a quien no controla ese
     * buzón. El caso real: el revisor de Meta, cuya cuenta vive en NUESTRO dominio — el
     * código llegaría a un buzón nuestro, no suyo.
     *
     * La exención se marca **por cuenta y solo en la base** (`sin_doble_factor`); no hay
     * forma de encenderla desde la app, que sería el primer sitio al que iría quien
     * entrara con una sesión robada. Ver la migración 029.
     *
     * ⚠️ EL ORDEN IMPORTA, Y ESTUVO MAL. Esto vivía DEBAJO del `validateOnly`, y los
     * modales de la portada preguntan primero con `validateOnly: true` para saber si las
     * credenciales valen antes de ofrecer «código o passkey». Con la exención debajo, la
     * respuesta salía antes de llegar a ella y la pantalla seguía pidiendo el segundo
     * paso. Va delante: si la cuenta está exenta, no hay nada que validar aparte — ya
     * hay sesión.
     *
     * ⚠️ La contraseña ya se comprobó arriba: lo que se salta es el segundo factor, no
     * el acceso. Y se deja constancia en el registro, para que una exención activa nunca
     * sea silenciosa.
     */
    if (user.sin_doble_factor) {
      console.info(`[auth] acceso sin segundo factor (cuenta exenta): ${cleanEmail}`);
      const token = await createToken({ userId: user.id, email: user.email, role: user.role });
      await setAuthCookie(token);
      // `sinCodigo` le dice a la pantalla que no pinte el paso del código: ya hay sesión.
      return NextResponse.json({ ok: true, sinCodigo: true, masked: maskEmail(cleanEmail) });
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
