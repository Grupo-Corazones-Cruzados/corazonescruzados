import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { candidatoDeLaSesionAlta, completarCuentaCorporativa } from '@/lib/auth/alta-candidato';

export const dynamic = 'force-dynamic';

/** GET — el candidato de la sesión de alta (para enseñar su nombre y su correo en el formulario). */
export async function GET() {
  const c = await candidatoDeLaSesionAlta();
  if (!c) return NextResponse.json({ error: 'Ingresa con tu correo corporativo y la contraseña temporal.' }, { status: 401 });
  return NextResponse.json({ nombre: c.full_name, correo: c.workspace_email });
}

/** POST { password, pais, telefono, direccion } — crea la contraseña, guarda los datos y abre la sesión del panel. */
export async function POST(req: Request) {
  const c = await candidatoDeLaSesionAlta();
  if (!c) return NextResponse.json({ error: 'La sesión del formulario venció. Ingresa otra vez con la contraseña temporal.' }, { status: 401 });
  const { password, pais, telefono, direccion } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400 });
  }
  const limpio = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const datos = { pais: limpio(pais, 80), telefono: limpio(telefono, 30), direccion: limpio(direccion, 300) };
  if (!datos.pais || !datos.telefono || !datos.direccion) {
    return NextResponse.json({ error: 'Completa el país, el teléfono y la dirección.' }, { status: 400 });
  }
  await pool.query(`UPDATE gcc_world.clients SET country = $1, phone = $2, address = $3 WHERE id = $4`,
    [datos.pais, datos.telefono, datos.direccion, c.id]);
  await completarCuentaCorporativa(c, await hashPassword(password));
  return NextResponse.json({ ok: true, destino: '/dashboard' });
}
