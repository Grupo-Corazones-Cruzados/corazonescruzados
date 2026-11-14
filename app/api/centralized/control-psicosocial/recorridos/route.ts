import { NextResponse } from 'next/server';
import { miembroDeSesion, recorridosDelDia } from '@/lib/centralized/control-psicosocial-db';
import { diasConHistorial } from '@/lib/centralized/control-psicosocial';

/** El recorrido de todos los miembros en un día (`AAAA-MM-DD`, hora de Ecuador). */
export async function GET(req: Request) {
  const m = await miembroDeSesion();
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  // Ver ubicaciones queda registrado a nombre de quien mira: suplantando, el registro diría que miró
  // la persona suplantada y no el administrador (auditoría de seguridad, 2026-11-14).
  if (m.suplantado) return NextResponse.json({ error: 'Las ubicaciones no se ven suplantando a otra persona' }, { status: 403 });
  const dia = new URL(req.url).searchParams.get('dia') || '';
  if (!diasConHistorial().includes(dia)) return NextResponse.json({ error: 'Día no válido' }, { status: 400 });
  try {
    return NextResponse.json({ data: await recorridosDelDia(m, dia) });
  } catch (err: any) {
    console.error('Recorridos:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el recorrido' }, { status: 500 });
  }
}
