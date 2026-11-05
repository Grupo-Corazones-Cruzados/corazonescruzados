import { NextResponse } from 'next/server';
import { crearLugar, datosDeLugar, miembroDeSesion } from '@/lib/centralized/control-psicosocial-db';

/** Crear un punto de reunión: solo administradores. Verlos va en el estado general. */
export async function POST(req: Request) {
  const m = await miembroDeSesion();
  if (!m?.isAdmin) return NextResponse.json({ error: 'Solo los administradores' }, { status: 403 });
  const datos = datosDeLugar(await req.json().catch(() => ({})));
  if (!datos) return NextResponse.json({ error: 'Revisa el nombre, el punto y el radio' }, { status: 400 });
  try {
    return NextResponse.json({ id: await crearLugar(m.userId, datos) }, { status: 201 });
  } catch (err: any) {
    console.error('Crear lugar:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}
