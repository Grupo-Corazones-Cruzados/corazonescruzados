import { NextResponse } from 'next/server';
import { estadoRastreo, miembroDeSesion } from '@/lib/centralized/control-psicosocial-db';

/** Lo que enseña la pantalla. Quien no es miembro no recibe nada. */
export async function GET() {
  const m = await miembroDeSesion();
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  try {
    return NextResponse.json({ data: await estadoRastreo(m) });
  } catch (err: any) {
    console.error('Control Psicosocial GET:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el rastreo' }, { status: 500 });
  }
}
