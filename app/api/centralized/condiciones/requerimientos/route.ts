import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listRequerimientos, createRequerimiento, deleteRequerimiento } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('task_id'));
    if (!id) return NextResponse.json({ error: 'Falta task_id' }, { status: 400 });
    return NextResponse.json({ data: await listRequerimientos(id) });
  } catch (err: any) {
    console.error('GC requerimientos GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { task_id, titulo, descripcion } = await req.json();
    if (!task_id) return NextResponse.json({ error: 'Falta task_id' }, { status: 400 });
    if (!titulo?.trim()) return NextResponse.json({ error: 'Falta titulo' }, { status: 400 });
    return NextResponse.json({ data: await createRequerimiento(task_id, titulo, descripcion) });
  } catch (err: any) {
    console.error('GC requerimientos POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    await deleteRequerimiento(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GC requerimientos DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
