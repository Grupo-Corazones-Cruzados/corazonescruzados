import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser, removeAuthCookie } from '@/lib/auth/jwt';
import { verifyPassword } from '@/lib/auth/password';
import { CuentaNoEliminable, eliminarCuentaEn } from '@/lib/auth/eliminar-cuenta';

/** La propia persona, con su contraseña: una sesión olvidada abierta no basta para borrar la cuenta. */
export async function POST(req: Request) {
  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
  if (sesion.suplantadoPor) return NextResponse.json({ error: 'Solo lo puede decidir la propia persona' }, { status: 403 });

  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Escribe tu contraseña' }, { status: 400 });
  }
  const { rows: [u] } = await pool.query(`SELECT password_hash FROM gcc_world.users WHERE id = $1`, [sesion.userId]);
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    return NextResponse.json({ error: 'La contraseña no es correcta' }, { status: 403 });
  }

  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    await eliminarCuentaEn(cli, sesion.userId);
    await cli.query('COMMIT');
  } catch (err) {
    await cli.query('ROLLBACK').catch(() => {});
    if (err instanceof CuentaNoEliminable) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error('Eliminar cuenta:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No se pudo eliminar la cuenta' }, { status: 500 });
  } finally {
    cli.release();
  }
  await removeAuthCookie();
  return NextResponse.json({ ok: true });
}
