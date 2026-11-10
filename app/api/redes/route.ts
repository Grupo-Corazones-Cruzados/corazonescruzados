import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { cuentasDeUsuario, PROVEEDORES, quitarCuenta, talentosDeUsuario } from '@/lib/redes/talento';
import { configurado } from '@/lib/redes/proveedores';

export const dynamic = 'force-dynamic';

/** GET — los talentos de la persona y lo que cada uno tiene conectado. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const [talentos, cuentas] = await Promise.all([talentosDeUsuario(u.userId), cuentasDeUsuario(u.userId)]);
  return NextResponse.json({
    talentos, cuentas,
    proveedores: Object.fromEntries(PROVEEDORES.map((p) => [p, configurado(p)])),
  });
}

/** DELETE ?id= — quita una cuenta. El permiso en la red se retira desde la propia red. */
export async function DELETE(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Cuenta no válida' }, { status: 400 });
  if (!(await quitarCuenta(u.userId, id))) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
