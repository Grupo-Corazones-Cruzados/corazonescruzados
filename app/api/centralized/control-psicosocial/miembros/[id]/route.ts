import { NextResponse } from 'next/server';
import { detalleMiembro, miembroDeSesion } from '@/lib/centralized/control-psicosocial-db';

/** La ubicación de un miembro. Sin permiso, 404. Mirar a otro queda registrado. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await miembroDeSesion();
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  try {
    const data = await detalleMiembro(m, id);
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Detalle de miembro:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar' }, { status: 500 });
  }
}
