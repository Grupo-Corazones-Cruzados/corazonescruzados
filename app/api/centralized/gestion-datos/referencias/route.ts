import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listReferencias, createReferencia, updateReferencia, deleteReferencia } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — lista de referencias bibliográficas (globales, reutilizables).
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listReferencias() });
  } catch (err: any) {
    console.error('GD referencias GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una referencia { ref_tipo, ref_datos }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { ref_tipo, ref_datos } = await req.json();
    if (!ref_tipo?.trim()) return NextResponse.json({ error: 'Falta el tipo de referencia' }, { status: 400 });
    return NextResponse.json({ data: await createReferencia(ref_tipo, ref_datos) });
  } catch (err: any) {
    console.error('GD referencias POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza una referencia { id, ref_tipo?, ref_datos? } (afecta a todas las fuentes que la usan).
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, ref_tipo, ref_datos } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateReferencia(Number(id), ref_tipo, ref_datos);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD referencias PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una referencia { id } (las fuentes que la usan quedan sin referencia).
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteReferencia(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD referencias DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
