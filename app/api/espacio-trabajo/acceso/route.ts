import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { pool } from '@/lib/db';
import { createToken, setAuthCookie, type UserRole } from '@/lib/auth/jwt';
import { cerrarSesion, emitirSesion, emitirToken, llamarServicio, rechazo } from '@/lib/espacio-trabajo/guardia';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const fuera = await rechazo(req, { sinSesion: true });
  if (fuera) return fuera;
  const { accion, clave } = await req.json().catch(() => ({}));
  if (accion === 'salir') { await cerrarSesion(); return NextResponse.json({ ok: true }); }
  if (accion !== 'crear' && accion !== 'entrar' && accion !== 'token') return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });

  const h = await headers();
  // La primera contraseña solo se crea sentado en la Mac, no desde la red privada.
  if (accion === 'crear' && h.get('tailscale-user-login')) return NextResponse.json({ error: 'La contraseña se crea desde esta Mac.' }, { status: 403 });

  let r: Response;
  try {
    r = await llamarServicio(`/acceso/${accion === 'token' ? 'entrar' : accion}`, { method: 'POST', body: JSON.stringify({ clave }) });
  } catch {
    return NextResponse.json({ error: 'El servicio local no está en marcha.' }, { status: 503 });
  }
  if (!r.ok) return NextResponse.json(await r.json().catch(() => ({ error: 'No se pudo entrar.' })), { status: r.status });

  // Dentro de la app no hace falta la cuenta de GCC: la app ya tiene su sesión.
  if (accion === 'token') return NextResponse.json({ token: await emitirToken() });

  const email = process.env['ESPACIO_ADMIN_EMAIL'];
  if (!email) return NextResponse.json({ error: 'Falta ESPACIO_ADMIN_EMAIL en la instancia local.' }, { status: 500 });
  const u = await pool.query<{ id: string; email: string; role: UserRole }>(
    `SELECT id, email, role FROM gcc_world.users WHERE lower(email) = lower($1) AND role = 'admin'`, [email]);
  if (!u.rows[0]) return NextResponse.json({ error: 'Esa cuenta no es de administrador.' }, { status: 403 });

  const seguro = (h.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
  await emitirSesion(seguro);
  await setAuthCookie(await createToken({ userId: String(u.rows[0].id), email: u.rows[0].email, role: u.rows[0].role }));
  return NextResponse.json({ ok: true });
}
