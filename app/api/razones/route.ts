import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listDays, listRazones, createRazon } from '@/lib/razones/db';

export const dynamic = 'force-dynamic';

const MAX_LEN = 50000;

/** GET — días con razones del usuario + las razones del día pedido (`?day=`). */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const day = req.nextUrl.searchParams.get('day') || undefined;
    const [days, razones] = await Promise.all([listDays(user.userId), listRazones(user.userId, day)]);
    return NextResponse.json({ data: { days, razones } });
  } catch (err: any) {
    console.error('Razones list:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar las razones.' }, { status: 500 });
  }
}

/** POST — captura rápida de una razón. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const b = await req.json();
    const content = String(b?.content ?? '').trim();
    if (!content) return NextResponse.json({ error: 'La razón está vacía.' }, { status: 400 });
    if (content.length > MAX_LEN) return NextResponse.json({ error: `Máximo ${MAX_LEN} caracteres.` }, { status: 400 });
    const data = await createRazon(user.userId, content);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Razones create:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar la razón.' }, { status: 500 });
  }
}
