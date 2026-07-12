import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { getPiezaGraph } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?pieza_id= — universo de gráficos del workspace de la pieza.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('pieza_id'));
    if (!id) return NextResponse.json({ error: 'Falta pieza_id' }, { status: 400 });
    return NextResponse.json({ data: await getPiezaGraph(id) });
  } catch (err: any) {
    console.error('GC pieza-grafo GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
