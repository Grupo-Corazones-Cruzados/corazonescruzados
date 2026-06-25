import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { RP_NAME, getWebAuthnRP } from '@/lib/world/webauthn';

type TransportLike =
  | 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';

/**
 * Registro de passkey para un USUARIO (cliente/staff) ya autenticado por JWT.
 * La passkey vive en una fila de gcc_world.clients vinculada por correo (la
 * misma que usa el login con passkey de /api/auth/passkey).
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const email = String(user.email).trim().toLowerCase();

    // Resuelve (o crea) la fila de "client" para este correo.
    let client = (
      await pool.query(
        `SELECT id, alias, email FROM gcc_world.clients WHERE LOWER(email) = $1
          ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
        [email],
      )
    ).rows[0];
    if (!client) {
      client = (
        await pool.query(
          `INSERT INTO gcc_world.clients (name, email, alias, last_seen_at)
           VALUES ($1, $1, $2, NOW()) RETURNING id, alias, email`,
          [email, email.split('@')[0]],
        )
      ).rows[0];
    }

    const existing = await pool.query(
      `SELECT credential_id, transports FROM gcc_world.client_passkeys WHERE client_id = $1`,
      [client.id],
    );

    const { rpId } = await getWebAuthnRP();
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId,
      userID: new TextEncoder().encode(`client-${client.id}`),
      userName: client.email || `client-${client.id}`,
      userDisplayName: client.alias || client.email || `Cliente ${client.id}`,
      attestationType: 'none',
      excludeCredentials: existing.rows.map(
        (p: { credential_id: string; transports: string[] | null }) => ({
          id: p.credential_id,
          transports: (p.transports ?? undefined) as TransportLike[] | undefined,
        }),
      ),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    await pool.query(
      `UPDATE gcc_world.clients
          SET webauthn_challenge = $1, webauthn_challenge_exp = NOW() + INTERVAL '5 minutes'
        WHERE id = $2`,
      [options.challenge, client.id],
    );

    return NextResponse.json(options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('User passkey register begin error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
