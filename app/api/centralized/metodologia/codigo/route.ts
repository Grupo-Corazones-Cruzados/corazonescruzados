import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { getCodigoDetalle } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — detalle de un código ?id=.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    return NextResponse.json({ data: await getCodigoDetalle(id) });
  } catch (err: any) {
    console.error('MET codigo GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
