import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { getPiezaWorkspace, setPiezaTipo, setPiezaCodigos } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — workspace de una pieza ?pieza_id=.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('pieza_id'));
    if (!id) return NextResponse.json({ error: 'Falta pieza_id' }, { status: 400 });
    return NextResponse.json({ data: await getPiezaWorkspace(id) });
  } catch (err: any) {
    console.error('Condiciones pieza GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza tipo o códigos de una pieza { pieza_id, tipo?, codigo_ids? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { pieza_id, tipo, codigo_ids } = await req.json();
    if (!pieza_id) return NextResponse.json({ error: 'Falta pieza_id' }, { status: 400 });
    if (tipo !== undefined) await setPiezaTipo(Number(pieza_id), tipo);
    if (Array.isArray(codigo_ids)) await setPiezaCodigos(Number(pieza_id), codigo_ids);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Condiciones pieza PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
