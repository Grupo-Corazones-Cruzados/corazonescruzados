import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createToken, setAuthCookie } from '@/lib/auth/jwt';

/**
 * Paso 2 del login de usuario (cliente/staff) con 2FA: valida el código y
 * completa la sesión (JWT).
 */
export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: 'Correo y código son requeridos' }, { status: 400 });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const r = await pool.query(
      `SELECT id, email, first_name, last_name, avatar_url, phone, role, member_id,
              is_verified, login_code, login_code_exp
         FROM gcc_world.users WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    const user = r.rows[0];
    if (!user || !user.login_code) {
      return NextResponse.json({ error: 'Solicita primero un código' }, { status: 400 });
    }
    if (!user.login_code_exp || new Date(user.login_code_exp).getTime() < Date.now()) {
      return NextResponse.json({ error: 'El código expiró, pide uno nuevo' }, { status: 400 });
    }
    if (user.login_code !== cleanCode) {
      return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
    }

    await pool.query(
      `UPDATE gcc_world.users SET login_code = NULL, login_code_exp = NULL WHERE id = $1`,
      [user.id],
    );

    const token = await createToken({ userId: user.id, email: user.email, role: user.role });
    await setAuthCookie(token);

    // La passkey del cliente vive en una fila de gcc_world.clients (por correo).
    let hasPasskey = false;
    const cl = await pool.query(
      `SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1
        ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
      [cleanEmail],
    );
    if (cl.rows[0]) {
      const pk = await pool.query(
        `SELECT 1 FROM gcc_world.client_passkeys WHERE client_id = $1 LIMIT 1`,
        [cl.rows[0].id],
      );
      hasPasskey = pk.rows.length > 0;
    }

    const {
      login_code: _c,
      login_code_exp: _e,
      ...safeUser
    } = user;
    return NextResponse.json({ user: safeUser, hasPasskey });
  } catch (error) {
    console.error('Login verify error:', error);
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}
