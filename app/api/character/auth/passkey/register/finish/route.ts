import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { AUTH_COOKIE } from '@/lib/world/session';
import { getWebAuthnRP } from '@/lib/world/webauthn';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const cookieStore = await cookies();
    const auth = cookieStore.get(AUTH_COOKIE)?.value;
    if (!auth) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const r = await pool.query(
      `SELECT id, webauthn_challenge, webauthn_challenge_exp
         FROM gcc_world.clients
        WHERE auth_token = $1 AND auth_expires > NOW()
        LIMIT 1`,
      [auth],
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
      return NextResponse.json(
        { error: 'No se pudo verificar la passkey' },
        { status: 400 },
      );
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
    console.error('Passkey register finish error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
