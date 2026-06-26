import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import {
  CLIENT_COOKIE,
  getClientIp,
  hashIp,
} from '@/lib/world/session';
import { getWebAuthnRP } from '@/lib/world/webauthn';

export async function POST(req: Request) {
  try {
    // Tipo esperado: el passkey solo debe autenticar cuentas de ese tipo
    // (p.ej. "Soy candidato" no debe entrar con una passkey de admin).
    let expect: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.expect === 'string') expect = body.expect;
    } catch {
      /* sin cuerpo */
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    let client: { id: number; email: string | null } | null = null;
    if (token) {
      const r = await pool.query(
        `SELECT id, email FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      client = r.rows[0] ?? null;
    }
    if (!client) {
      const r = await pool.query(
        `SELECT id, email FROM gcc_world.clients
          WHERE ip_hash = $1
          ORDER BY last_seen_at DESC NULLS LAST
          LIMIT 1`,
        [ipHash],
      );
      client = r.rows[0] ?? null;
    }
    if (!client) {
      return NextResponse.json(
        { error: 'No se encontró ninguna cuenta en este dispositivo' },
        { status: 404 },
      );
    }

    // Verifica que el tipo de la cuenta coincida con el esperado.
    if (expect) {
      let kind: 'member' | 'client' | 'candidate' = 'candidate';
      if (client.email) {
        const ur = await pool.query(
          `SELECT role FROM gcc_world.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [client.email],
        );
        const role = ur.rows[0]?.role as string | undefined;
        if (role === 'member' || role === 'admin') kind = 'member';
        else if (role) kind = 'client';
      }
      if (expect !== kind) {
        return NextResponse.json(
          { error: `Esta cuenta es de tipo ${kind}. Usa la opción correcta para ingresar.` },
          { status: 403 },
        );
      }
    }

    const passkeys = await pool.query(
      `SELECT credential_id, transports FROM gcc_world.client_passkeys WHERE client_id = $1`,
      [client.id],
    );
    if (passkeys.rows.length === 0) {
      return NextResponse.json(
        { error: 'No hay passkeys registradas en esta cuenta' },
        { status: 404 },
      );
    }

    const { rpId } = await getWebAuthnRP();
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials: passkeys.rows.map(
        (p: { credential_id: string; transports: string[] | null }) => ({
          id: p.credential_id,
          transports: (p.transports ?? undefined) as
            | AuthenticatorTransportFutureLike[]
            | undefined,
        }),
      ),
      userVerification: 'preferred',
    });

    await pool.query(
      `UPDATE gcc_world.clients
          SET webauthn_challenge = $1,
              webauthn_challenge_exp = NOW() + INTERVAL '5 minutes'
        WHERE id = $2`,
      [options.challenge, client.id],
    );

    return NextResponse.json(options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Passkey login begin error:', msg);
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
