import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  CLIENT_COOKIE,
  COOKIE_MAX_AGE,
  generateClientToken,
  getClientIp,
  hashIp,
} from '@/lib/world/session';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const characterData = body?.characterData;
    const aliasInput =
      typeof body?.alias === 'string' ? body.alias.trim() : '';
    const alias =
      aliasInput ||
      (typeof characterData?.name === 'string'
        ? characterData.name.trim()
        : '');

    if (!alias || !characterData || typeof characterData !== 'object') {
      return NextResponse.json(
        { error: 'alias y characterData son requeridos' },
        { status: 400 },
      );
    }

    const json = JSON.stringify(characterData);
    const user = await getCurrentUser();

    const ip = await getClientIp();
    const ipHash = hashIp(ip);

    const cookieStore = await cookies();
    let token = cookieStore.get(CLIENT_COOKIE)?.value;
    if (!token) token = generateClientToken();

    let clientId: number | null = null;

    if (user) {
      // Personaje de un miembro/admin (staff): queda aprobado y verificado
      // (no pasa por el gate de aprobación de candidatos).
      await pool.query(
        `ALTER TABLE gcc_world.clients
           ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
           ADD COLUMN IF NOT EXISTS user_id uuid`,
      );
      const { rows } = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
        [user.id],
      );
      if (rows.length > 0) {
        const updated = await pool.query(
          `UPDATE gcc_world.clients
              SET alias = $1,
                  character_data = $2::jsonb,
                  client_token = $3,
                  ip_hash = $4,
                  approved = true,
                  email_verified = true,
                  last_seen_at = NOW()
            WHERE id = $5
          RETURNING id`,
          [alias, json, token, ipHash, rows[0].id],
        );
        clientId = updated.rows[0].id;
      } else {
        const inserted = await pool.query(
          `INSERT INTO gcc_world.clients
              (name, email, user_id, alias, character_data,
               client_token, ip_hash, approved, email_verified, last_seen_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, true, true, NOW())
           RETURNING id`,
          [alias, user.email, user.id, alias, json, token, ipHash],
        );
        clientId = inserted.rows[0].id;
      }
    } else {
      // ¿Ya hay una fila para este dispositivo (p.ej. candidato aprobado con
      // contraseña temporal)? La actualizamos con el personaje, preservando su
      // email/aprobación/verificación. Si no, creamos un invitado.
      const existingByToken = await pool.query(
        `SELECT id FROM gcc_world.clients WHERE client_token = $1 LIMIT 1`,
        [token],
      );
      if (existingByToken.rows.length > 0) {
        const updated = await pool.query(
          `UPDATE gcc_world.clients
              SET alias = $1, character_data = $2::jsonb, ip_hash = $3, last_seen_at = NOW()
            WHERE id = $4 RETURNING id`,
          [alias, json, ipHash, existingByToken.rows[0].id],
        );
        clientId = updated.rows[0].id;
      } else {
        const guestEmail = `${alias.toLowerCase()}-${Date.now()}@guest.gcc-world.local`;
        const inserted = await pool.query(
          `INSERT INTO gcc_world.clients
              (name, email, alias, character_data,
               client_token, ip_hash, last_seen_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
           RETURNING id`,
          [alias, guestEmail, alias, json, token, ipHash],
        );
        clientId = inserted.rows[0].id;
      }
    }

    cookieStore.set(CLIENT_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    return NextResponse.json({
      ok: true,
      clientId,
      alias,
      guest: !user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('Character save error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
