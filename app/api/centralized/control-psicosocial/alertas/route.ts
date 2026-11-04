import { NextResponse } from 'next/server';
import { miembroDeLlamada, pedirAuxilio } from '@/lib/centralized/control-psicosocial-db';

/** Pedir auxilio: el botón (sesión) o la frase de voz (llave del teléfono). */
export async function POST(req: Request) {
  const m = await miembroDeLlamada(req);
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  if (m.suplantado) return NextResponse.json({ error: 'Solo lo puede pedir la propia persona' }, { status: 403 });
  const { origen, lat, lng } = await req.json().catch(() => ({}));
  const la = lat === null || lat === undefined ? NaN : Number(lat);
  const lo = lng === null || lng === undefined ? NaN : Number(lng);
  const conPunto = Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
  try {
    const r = await pedirAuxilio(m, origen === 'voz' ? 'voz' : 'boton', conPunto ? la : null, conPunto ? lo : null);
    return NextResponse.json(r, { status: r.repetida ? 200 : 201 });
  } catch (err: any) {
    console.error('Auxilio:', err.message);
    return NextResponse.json({ error: 'No se pudo enviar el auxilio' }, { status: 500 });
  }
}
