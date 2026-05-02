import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { AUTH_COOKIE } from '@/lib/world/session';
import { RP_ID, RP_NAME } from '@/lib/world/webauthn';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const auth = cookieStore.get(AUTH_COOKIE)?.value;
    if (!auth) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    }

    const r = await pool.query(
      `SELECT id, alias, email FROM gcc_world.clients
        WHERE auth_token = $1 AND auth_expires > NOW()
        LIMIT 1`,
      [auth],
    );
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: 'Sesión inválida' },
        { status: 401 },
      );
    }

    const existing = await pool.query(
      `SELECT credential_id, transports FROM gcc_world.client_passkeys WHERE client_id = $1`,
      [row.id],
    );

    const userId = new TextEncoder().encode(`client-${row.id}`);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: row.email || row.alias || `client-${row.id}`,
      userDisplayName: row.alias || row.email || `Jugador ${row.id}`,
      attestationType: 'none',
      excludeCredentials: existing.rows.map(
        (p: { credential_id: string; transports: string[] | null }) => ({
          id: p.credential_id,
          transports: (p.transports ?? undefined) as
            | AuthenticatorTransportFutureLike[]
            | undefined,
        }),
      ),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await pool.query(
      `UPDATE gcc_world.clients
          SET webauthn_challenge = $1,
              webauthn_challenge_exp = NOW() + INTERVAL '5 minutes'
        WHERE id = $2`,
      [options.challenge, row.id],
    );

    return NextResponse.json(options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Passkey register begin error:', msg);
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
