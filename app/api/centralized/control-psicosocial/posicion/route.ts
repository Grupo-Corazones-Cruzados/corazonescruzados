import { NextResponse } from 'next/server';
import { guardarPosiciones, miembroDeLlamada, validarPuntos } from '@/lib/centralized/control-psicosocial-db';

/**
 * El teléfono manda sus posiciones con su llave. 401 = llave revocada o ya no es miembro; 403 =
 * retiró el consentimiento. En los dos casos el teléfono se apaga solo.
 */
export async function POST(req: Request) {
  const m = await miembroDeLlamada(req);
  if (!m?.dispositivoId) return NextResponse.json({ error: 'Llave no válida' }, { status: 401 });
  const { puntos } = await req.json().catch(() => ({}));
  try {
    const r = await guardarPosiciones(m, validarPuntos(puntos));
    if (!r.consentida) return NextResponse.json({ error: 'Sin consentimiento' }, { status: 403 });
    return NextResponse.json(r);
  } catch (err: any) {
    console.error('Posición:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}
