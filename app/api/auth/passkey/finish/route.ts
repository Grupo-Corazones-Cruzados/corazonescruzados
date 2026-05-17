import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getWebAuthnRP } from '@/lib/world/webauthn';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';
import { CLIENT_COOKIE, getClientIp, hashIp } from '@/lib/world/session';

type TransportLike =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';

type ResolvedClient = {
  id: number;
  email: string;
  webauthn_challenge: string | null;
  webauthn_challenge_exp: string | null;
};

// Mismo criterio que /begin: por email si llega, si no por cookie/IP.
async function resolveClient(
  email: string | null,
): Promise<ResolvedClient | null> {
  const cols = `id, email, webauthn_challenge, webauthn_challenge_exp`;
  if (email) {
    const r = await pool.query(
      `SELECT ${cols} FROM gcc_world.clients
        WHERE lower(email) = $1
        ORDER BY last_seen_at DESC NULLS LAST
        LIMIT 1`,
      [email],
    );
    return r.rows[0] ?? null;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
  if (token) {
    const r = await pool.query(
      `SELECT ${cols} FROM gcc_world.clients
        WHERE client_token = $1 LIMIT 1`,
      [token],
    );
    if (r.rows[0]) return r.rows[0];
  }
  const ipHash = hashIp(await getClientIp());
  const r = await pool.query(
    `SELECT ${cols} FROM gcc_world.clients
      WHERE ip_hash = $1
      ORDER BY last_seen_at DESC NULLS LAST
      LIMIT 1`,
    [ipHash],
  );
  return r.rows[0] ?? null;
}

// Verifica el passkey del client y, si su email corresponde a un user de
// staff verificado, emite la sesión JWT de staff (cookie auth_token).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email =
      typeof body?.email === 'string' && body.email.trim()
        ? body.email.toLowerCase().trim()
        : null;
    const credential = body?.credential;
    const credentialId =
      typeof credential?.id === 'string' ? credential.id : null;
    if (!credentialId) {
      return NextResponse.json(
        { error: 'Respuesta inválida' },
        { status: 400 },
      );
    }

    const client = await resolveClient(email);
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

    // El usuario de staff se deriva SIEMPRE del email del client (fuente
    // de verdad de a quién pertenece el passkey).
    const u = await pool.query(
      `SELECT id, email, first_name, last_name, avatar_url, phone,
              role, member_id, is_verified
         FROM gcc_world.users WHERE lower(email) = lower($1) LIMIT 1`,
      [client.email],
    );
    const user = u.rows[0];
    if (!user) {
      return NextResponse.json(
        { error: 'No hay una cuenta de colaborador con ese correo' },
        { status: 404 },
      );
    }
    if (!user.is_verified) {
      return NextResponse.json(
        { error: 'Debes verificar tu correo antes de iniciar sesión.' },
        { status: 403 },
      );
    }

    const pk = await pool.query(
      `SELECT credential_id, credential_public_key, counter, transports
         FROM gcc_world.client_passkeys
        WHERE client_id = $1 AND credential_id = $2
        LIMIT 1`,
      [client.id, credentialId],
    );
    if (pk.rows.length === 0) {
      return NextResponse.json(
        { error: 'Passkey desconocida' },
        { status: 404 },
      );
    }
    const stored = pk.rows[0];

    const { rpId, origin } = await getWebAuthnRP();
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: client.webauthn_challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: stored.credential_id as string,
        publicKey: new Uint8Array(stored.credential_public_key as Buffer),
        counter: Number(stored.counter),
        transports:
          (stored.transports as string[] | null)?.filter(
            (t): t is TransportLike => typeof t === 'string',
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

    await pool.query(
      `UPDATE gcc_world.client_passkeys
          SET counter = $1, last_used_at = NOW()
        WHERE credential_id = $2`,
      [verification.authenticationInfo.newCounter, stored.credential_id],
    );
    await pool.query(
      `UPDATE gcc_world.clients
          SET webauthn_challenge = NULL, webauthn_challenge_exp = NULL
        WHERE id = $1`,
      [client.id],
    );

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    await setAuthCookie(token);

    return NextResponse.json({ user });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Auth passkey finish error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
