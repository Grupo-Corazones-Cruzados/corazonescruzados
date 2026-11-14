import { NextResponse } from 'next/server';
import { estadoRastreo, miembroDeSesion } from '@/lib/centralized/control-psicosocial-db';

/** Lo que enseña la pantalla. Quien no es miembro no recibe nada. */
export async function GET(req: Request) {
  const m = await miembroDeSesion();
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  // Ver ubicaciones queda registrado a nombre de quien mira: suplantando, el registro diría que miró
  // la persona suplantada y no el administrador (auditoría de seguridad, 2026-11-14).
  if (m.suplantado) return NextResponse.json({ error: 'Las ubicaciones no se ven suplantando a otra persona' }, { status: 403 });
  try {
    return NextResponse.json({ data: await estadoRastreo(m, new URL(req.url).searchParams.get('solo') === 'mio') });
  } catch (err: any) {
    console.error('Control Psicosocial GET:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el rastreo' }, { status: 500 });
  }
}
