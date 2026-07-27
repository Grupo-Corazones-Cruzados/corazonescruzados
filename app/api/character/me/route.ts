import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE } from '@/lib/world/session';
import { getPlayerSession } from '@/lib/world/player';

/**
 * El personaje del jugador que TIENE LA SESIÓN INICIADA.
 *
 * Ya NO reconoce por cookie de dispositivo (`gcc_client_token`) ni por `ip_hash`: el
 * personaje pertenece a la cuenta, no al aparato (ver `lib/world/player.ts`). Sin
 * sesión devuelve `{ exists: false }`, así que la landing no puede "reconocer" a nadie
 * para saltarse el login.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();

    // approved: aprobación del administrador global (gate de entrada al juego).
    // user_id: enlace con el usuario de gcc_world.users dueño del personaje.
    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS user_id uuid,
         ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false`,
    );

    // Sesión: JWT de gcc_world.users (miembro/admin/cliente/candidato) o, en su
    // defecto, sesión de jugador (`gcc_player_auth`). `staff` se sigue usando para
    // resolver isMember/hasAccount.
    const { user: staff, clientId } = await getPlayerSession();
    if (!clientId) {
      return NextResponse.json({ exists: false });
    }

    const COLS = `id, alias, character_data, password_hash, email_verified, approved,
                  profile_completed, pending_email, email, user_id, full_name, country,
                  address, phone, auth_token, auth_expires, last_seen_at`;
    const r = await pool.query(
      `SELECT ${COLS} FROM gcc_world.clients WHERE id = $1 LIMIT 1`,
      [clientId],
    );
    const row: Record<string, unknown> | null = r.rows[0] ?? null;

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
    // usuario staff. hasAccount: tiene cuenta en gcc_world.users (member/admin/
    // CLIENTE) → no se le pide el formulario "crea tu cuenta".
    let isMember = row.user_id != null;
    let hasAccount = isMember;
    if (row.email) {
      const ur = await pool.query(
        `SELECT role FROM gcc_world.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [row.email],
      );
      const role = ur.rows[0]?.role as string | undefined;
      if (role) {
        hasAccount = true;
        if (role === 'member' || role === 'admin') isMember = true;
      }
    }
    // Si hay sesión de staff logueada, el jugador YA tiene cuenta (member/admin/
    // cliente) → nunca debe mostrarse "crea tu cuenta", aunque la fila de clients
    // matcheada no tenga user_id ni correo que coincida.
    if (staff) {
      hasAccount = true;
      if (staff.role === 'member' || staff.role === 'admin') isMember = true;
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
      // hasAccount: tiene cuenta en gcc_world.users (incl. CLIENTE) → tampoco se
      // le pide el formulario "crea tu cuenta".
      hasAccount,
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
