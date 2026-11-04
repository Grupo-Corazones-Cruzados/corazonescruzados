import { NextResponse } from 'next/server';
import { fijarConsentimiento, miembroDeSesion } from '@/lib/centralized/control-psicosocial-db';

/** Aceptar o retirar. Solo la propia persona: un admin viendo «como otro» no puede decidir por él. */
export async function POST(req: Request) {
  const m = await miembroDeSesion();
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  if (m.suplantado) return NextResponse.json({ error: 'Solo lo puede decidir la propia persona' }, { status: 403 });
  const { funcion, activo, plataforma } = await req.json().catch(() => ({}));
  if ((funcion !== 'ubicacion' && funcion !== 'voz') || typeof activo !== 'boolean') {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  }
  try {
    await fijarConsentimiento(m.userId, funcion, activo, ['android', 'ios'].includes(plataforma) ? plataforma : null);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Consentimiento:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}
