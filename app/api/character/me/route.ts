import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  AUTH_COOKIE,
  CLIENT_COOKIE,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CLIENT_COOKIE)?.value || null;
    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    let row: Record<string, unknown> | null = null;

    // approved: aprobación del administrador global (gate de entrada al juego).
    // user_id: si está enlazado a un usuario staff (miembro/admin).
    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS user_id uuid,
         ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false`,
    );

    const COLS = `id, alias, character_data, password_hash, email_verified, approved,
                  profile_completed, pending_email, email, user_id, full_name, country,
                  address, phone, auth_token, auth_expires, last_seen_at`;
    if (token) {
      const r = await pool.query(
        `SELECT ${COLS} FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      row = r.rows[0] ?? null;
    }

    if (!row) {
      const r = await pool.query(
        `SELECT ${COLS} FROM gcc_world.clients
          WHERE ip_hash = $1 AND character_data IS NOT NULL
          ORDER BY last_seen_at DESC NULLS LAST
          LIMIT 1`,
        [ipHash],
      );
      row = r.rows[0] ?? null;
    }

    // Fallback robusto: miembro/admin con sesión de staff (JWT) → reconoce su
    // personaje por user_id o correo aunque la cookie/IP de jugador no coincidan.
    if (!row) {
      const staff = await getCurrentUser();
      if (staff) {
        const r = await pool.query(
          `SELECT ${COLS} FROM gcc_world.clients
            WHERE (user_id = $1 OR LOWER(email) = LOWER($2)) AND character_data IS NOT NULL
            ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
          [staff.userId, staff.email],
        );
        row = r.rows[0] ?? null;
      }
    }

    if (!row) {
      return NextResponse.json({ exists: false });
    }

    if (row.character_data == null) {
      return NextResponse.json({ exists: false });
    }

    await pool.query(
      `UPDATE gcc_world.clients SET last_seen_at = NOW() WHERE id = $1`,
      [row.id],
    );

    // Miembro/admin: por user_id enlazado o porque su correo coincide con un
    // usuario staff (fallback robusto si el personaje no quedó vinculado).
    let isMember = row.user_id != null;
    if (!isMember && row.email) {
      const ur = await pool.query(
        `SELECT 1 FROM gcc_world.users WHERE LOWER(email) = LOWER($1) AND role IN ('member','admin') LIMIT 1`,
        [row.email],
      );
      isMember = ur.rows.length > 0;
    }

    const authCookie = cookieStore.get(AUTH_COOKIE)?.value || null;
    const authValid =
      !!authCookie &&
      !!row.auth_token &&
      authCookie === row.auth_token &&
      row.auth_expires &&
      new Date(row.auth_expires as string).getTime() > Date.now();

    return NextResponse.json({
      exists: true,
      clientId: row.id,
      alias: row.alias,
      characterData: row.character_data,
      hasPassword: !!row.password_hash,
      emailVerified: !!row.email_verified,
      approved: !!row.approved,
      profileCompleted: !!row.profile_completed,
      pendingEmail: row.pending_email,
      email: row.email,
      // Miembro/admin: el personaje está enlazado a un usuario staff → no se le
      // pide el formulario de "crear cuenta" (ya tiene cuenta en gcc_world.users).
      isMember,
      profile: {
        fullName: row.full_name ?? '',
        country: row.country ?? '',
        address: row.address ?? '',
        phone: row.phone ?? '',
      },
      authenticated: !!authValid,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Character /me error:', message);
    return NextResponse.json({ error: message, exists: false }, { status: 500 });
  }
}
