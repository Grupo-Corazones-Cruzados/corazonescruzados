import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  CLIENT_COOKIE,
  getClientIp,
  hashIp,
} from '@/lib/world/session';
import { RP_ID, RP_ORIGIN } from '@/lib/world/webauthn';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    let client: {
      id: number;
      webauthn_challenge: string | null;
      webauthn_challenge_exp: string | null;
    } | null = null;
    if (token) {
      const r = await pool.query(
        `SELECT id, webauthn_challenge, webauthn_challenge_exp
           FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      client = r.rows[0] ?? null;
    }
    if (!client) {
      const r = await pool.query(
        `SELECT id, webauthn_challenge, webauthn_challenge_exp
           FROM gcc_world.clients
          WHERE ip_hash = $1
          ORDER BY last_seen_at DESC NULLS LAST
          LIMIT 1`,
        [ipHash],
      );
      client = r.rows[0] ?? null;
    }
    if (
      !client ||
      !client.webauthn_challenge ||
      !client.webauthn_challenge_exp ||
      new Date(client.webauthn_challenge_exp).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: 'Reto inválido o expirado' },
        { status: 400 },
      );
    }

    const credentialId =
      typeof body?.id === 'string' ? body.id : null;
    if (!credentialId) {
      return NextResponse.json(
        { error: 'Respuesta inválida' },
        { status: 400 },
      );
    }
    const passkey = await pool.query(
      `SELECT credential_id, credential_public_key, counter, transports
         FROM gcc_world.client_passkeys
        WHERE client_id = $1 AND credential_id = $2
        LIMIT 1`,
      [client.id, credentialId],
    );
    if (passkey.rows.length === 0) {
      return NextResponse.json(
        { error: 'Passkey desconocida' },
        { status: 404 },
      );
    }
    const stored = passkey.rows[0];

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: client.webauthn_challenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: stored.credential_id as string,
        publicKey: new Uint8Array(stored.credential_public_key as Buffer),
        counter: Number(stored.counter),
        transports:
          (stored.transports as string[] | null)?.filter(
            (t): t is AuthenticatorTransportFutureLike =>
              typeof t === 'string',
          ) ?? undefined,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Verificación fallida' },
        { status: 401 },
      );
    }

    const newCounter = verification.authenticationInfo.newCounter;
    const authToken = randomBytes(32).toString('hex');

    await pool.query(
      `UPDATE gcc_world.client_passkeys
          SET counter = $1, last_used_at = NOW()
        WHERE credential_id = $2`,
      [newCounter, stored.credential_id],
    );
    await pool.query(
      `UPDATE gcc_world.clients
          SET auth_token = $1,
              auth_expires = NOW() + INTERVAL '30 days',
              ip_hash = $2,
              last_seen_at = NOW(),
              webauthn_challenge = NULL,
              webauthn_challenge_exp = NULL
        WHERE id = $3`,
      [authToken, ipHash, client.id],
    );

    cookieStore.set(AUTH_COOKIE, authToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Passkey login finish error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

type AuthenticatorTransportFutureLike =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';
