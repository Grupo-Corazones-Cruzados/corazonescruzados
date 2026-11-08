import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser, type TokenPayload } from '@/lib/auth/jwt';
import { accessRoleOf, canAccess, type AccessRole } from '@/lib/dashboard/access';

/**
 * ¿Quien tiene sesión puede usar Herramientas? Lo decide la MISMA matriz que el menú y el
 * guard de rutas (`/dashboard/tools` en `lib/dashboard/access.ts`): desde el 2026-11-08, todas
 * las cuentas. Lo «solo del equipo» lo sigue comprobando cada API con `rol`.
 *
 * El token solo trae `role`, y candidato y cliente comparten `role = 'client'`: lo que los
 * separa es `clients.account_type`, así que para ellos se pregunta a la base.
 */
export async function usuarioDeHerramientas(): Promise<
  { user: TokenPayload; rol: AccessRole; error?: undefined } | { error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Inicia sesión' }, { status: 401 }) };
  let accountType: 'candidate' | 'client' | null = null;
  if (user.role === 'client') {
    const { rows: [c] } = await pool.query(
      `SELECT account_type FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`,
      [user.userId],
    );
    accountType = c?.account_type ?? null;
  }
  const rol = accessRoleOf({ role: user.role, account_type: accountType });
  if (!canAccess(rol, '/dashboard/tools')) {
    return { error: NextResponse.json({ error: 'No tienes acceso a Herramientas' }, { status: 403 }) };
  }
  return { user, rol };
}
