import { NextResponse } from 'next/server';
import { crearDispositivo, miembroDeLlamada, miembroDeSesion, revocarDispositivo } from '@/lib/centralized/control-psicosocial-db';

/** Da la llave de ESTE teléfono. Solo con sesión real de la propia persona. */
export async function POST(req: Request) {
  const m = await miembroDeSesion();
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  if (m.suplantado) return NextResponse.json({ error: 'Solo lo puede activar la propia persona' }, { status: 403 });
  const { plataforma } = await req.json().catch(() => ({}));
  if (plataforma !== 'android' && plataforma !== 'ios') {
    return NextResponse.json({ error: 'Plataforma no válida' }, { status: 400 });
  }
  return NextResponse.json({ token: await crearDispositivo(m.userId, plataforma) }, { status: 201 });
}

/** El teléfono entrega su llave al apagarse. */
export async function DELETE(req: Request) {
  const m = await miembroDeLlamada(req);
  if (!m?.dispositivoId) return NextResponse.json({ error: 'Llave no válida' }, { status: 401 });
  await revocarDispositivo(m.dispositivoId);
  return NextResponse.json({ ok: true });
}
