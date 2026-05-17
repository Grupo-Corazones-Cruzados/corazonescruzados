import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getWebAuthnRP } from '@/lib/world/webauthn';
import { CLIENT_COOKIE, getClientIp, hashIp } from '@/lib/world/session';

type TransportLike =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';

// Resuelve el "client" (jugador) del mundo cuyo passkey usaremos:
//  - si llega `email`, por email (mismo correo = misma persona);
//  - si no, por cookie de cliente o por IP (igual que el passkey del juego).
async function resolveClient(
  email: string | null,
): Promise<{ id: number; email: string } | null> {
  if (email) {
    const r = await pool.query(
      `SELECT id, email FROM gcc_world.clients
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
      `SELECT id, email FROM gcc_world.clients
        WHERE client_token = $1 LIMIT 1`,
      [token],
    );
    if (r.rows[0]) return r.rows[0];
  }
  const ipHash = hashIp(await getClientIp());
  const r = await pool.query(
    `SELECT id, email FROM gcc_world.clients
      WHERE ip_hash = $1
      ORDER BY last_seen_at DESC NULLS LAST
      LIMIT 1`,
    [ipHash],
  );
  return r.rows[0] ?? null;
}

// Inicio de sesión de STAFF con passkey en /auth. El passkey vive en el
// "client" (jugador); lo puenteamos al user de staff por email. Sólo si
// existe un user verificado con ese correo y el client tiene passkeys.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body?.email === 'string' && body.email.trim()
        ? body.email.toLowerCase().trim()
        : null;

    const client = await resolveClient(email);
    if (!client) {
      return NextResponse.json(
        {
          error: email
            ? 'No hay passkeys registradas para este correo'
            : 'No se reconoce este dispositivo. Escribe tu correo para usar passkey.',
        },
        { status: 404 },
      );
    }

    // El email del client debe corresponder a un user de staff verificado.
    const u = await pool.query(
      `SELECT id FROM gcc_world.users
        WHERE lower(email) = lower($1) AND is_verified = true
        LIMIT 1`,
      [client.email],
    );
    if (u.rows.length === 0) {
      return NextResponse.json(
        { error: 'No hay una cuenta de colaborador con ese correo' },
        { status: 404 },
      );
    }

    const pk = await pool.query(
      `SELECT credential_id, transports
         FROM gcc_world.client_passkeys WHERE client_id = $1`,
      [client.id],
    );
    if (pk.rows.length === 0) {
      return NextResponse.json(
        { error: 'No hay passkeys registradas para esta cuenta' },
        { status: 404 },
      );
    }

    const { rpId } = await getWebAuthnRP();
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials: pk.rows.map(
        (p: { credential_id: string; transports: string[] | null }) => ({
          id: p.credential_id,
          transports: (p.transports ?? undefined) as
            | TransportLike[]
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
    console.error('Auth passkey begin error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
