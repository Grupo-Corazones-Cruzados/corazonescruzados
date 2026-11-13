import { pool } from '@/lib/db';
import { claveValida, DemasiadosIntentos, respuestaDemasiadosIntentos } from '@/lib/auth/intentos';
import { codigoNuevo } from '@/lib/auth/codigo-acceso';
import { NextResponse } from 'next/server';
import { sendCodigoDeRecuperacionEmail } from '@/lib/integrations/email';
import { getWebAuthnRP } from '@/lib/world/webauthn';

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

// Aleatoriedad criptográfica y contador de intentos: `lib/auth/codigo-acceso`.
const generateCode = codigoNuevo;

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

    // ⇒ CON CORREO CORPORATIVO, SOLO ÉL (Fernando, 2026-11-12): el candidato aceptado con el flujo nuevo inicia sesión
    // con su `@grupocc.org`; su correo personal ya no abre la cuenta, y el código va al corporativo.
    await pool.query(`ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS workspace_tipo text`);
    const r = await pool.query(
      `SELECT id, alias, password_hash, email_verified, email, workspace_email, workspace_tipo
         FROM gcc_world.clients
        WHERE LOWER(email) = $1 OR (workspace_tipo = 'grupo' AND LOWER(workspace_email) = $1)
        ORDER BY (LOWER(workspace_email) = $1) DESC
        LIMIT 1`,
      [cleanEmail],
    );
    const row = r.rows[0];
    const corporativo = row?.workspace_tipo === 'grupo' && row.workspace_email ? String(row.workspace_email).toLowerCase() : null;
    if (corporativo && cleanEmail !== corporativo) {
      return NextResponse.json({ error: `Ingresa con tu correo corporativo (${corporativo}).` }, { status: 403 });
    }
    if (corporativo) row.email = corporativo;
    if (!row || !row.password_hash) {
      await claveValida(cleanEmail, password, null); // mira el bloqueo y anota el fallo, como con una cuenta real
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
    const ok = await claveValida(cleanEmail, password, row.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 },
      );
    }

    /**
     * validateOnly: solo confirma las credenciales (paso 1) sin enviar el código, y dice
     * QUÉ segundos pasos hay disponibles.
     *
     * ⚠️ `tienePasskey` no es un adorno: sin él la pantalla pintaba «Ingresar con passkey»
     * a todo el mundo y quien no tenía ninguna recibía un aviso en rojo al pulsarlo
     * (Fernando, 2026-09-27: «cuando el usuario no tiene passkey configurado, en ninguna
     * pantalla de login debería aparecerle el botón»). Se filtra por `rp_id` porque las
     * de antes del cambio de dominio ya no las acepta el navegador (migración 062).
     */
    if (validateOnly) {
      const { rpId } = await getWebAuthnRP();
      const { rows: llaves } = await pool.query(
        `SELECT 1 FROM gcc_world.client_passkeys WHERE client_id = $1 AND rp_id = $2 LIMIT 1`,
        [row.id, rpId],
      );
      return NextResponse.json({
        ok: true,
        masked: maskEmail(row.email),
        tienePasskey: llaves.length > 0,
      });
    }

    const code = generateCode();
    await pool.query(
      `UPDATE gcc_world.clients
          SET recovery_code = $1,
              recovery_code_exp = NOW() + INTERVAL '15 minutes',
              recovery_code_intentos = 0
        WHERE id = $2`,
      [code, row.id],
    );

    try {
      await sendCodigoDeRecuperacionEmail(
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
    if (err instanceof DemasiadosIntentos) return respuestaDemasiadosIntentos();
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Recovery begin error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
