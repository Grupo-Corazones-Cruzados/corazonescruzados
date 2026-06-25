import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getWebAuthnRP } from '@/lib/world/webauthn';

/** Registro de passkey de USUARIO (cliente/staff) — paso 2. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const email = String(user.email).trim().toLowerCase();

    const r = await pool.query(
      `SELECT id, webauthn_challenge, webauthn_challenge_exp
         FROM gcc_world.clients WHERE LOWER(email) = $1
        ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
      [email],
    );
    const row = r.rows[0];
    if (
      !row ||
      !row.webauthn_challenge ||
      !row.webauthn_challenge_exp ||
      new Date(row.webauthn_challenge_exp).getTime() < Date.now()
    ) {
      return NextResponse.json({ error: 'Reto inválido' }, { status: 400 });
    }

    const { rpId, origin } = await getWebAuthnRP();
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: row.webauthn_challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'No se pudo verificar la passkey' }, { status: 400 });
    }

    const info = verification.registrationInfo;
    const cred = info.credential;
    await pool.query(
      `INSERT INTO gcc_world.client_passkeys
         (client_id, credential_id, credential_public_key, counter,
          device_type, backed_up, transports, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (credential_id) DO UPDATE
          SET counter = EXCLUDED.counter, last_used_at = NOW()`,
      [
        row.id,
        cred.id,
        Buffer.from(cred.publicKey),
        cred.counter,
        info.credentialDeviceType ?? null,
        info.credentialBackedUp ?? null,
        cred.transports ?? null,
      ],
    );
    await pool.query(
      `UPDATE gcc_world.clients
          SET webauthn_challenge = NULL, webauthn_challenge_exp = NULL
        WHERE id = $1`,
      [row.id],
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('User passkey register finish error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
