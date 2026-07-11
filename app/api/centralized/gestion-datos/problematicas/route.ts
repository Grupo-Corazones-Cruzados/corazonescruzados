import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listProblematicas, createProblematica, updateProblematica, deleteProblematica } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — lista de problemáticas.
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listProblematicas() });
  } catch (err: any) {
    console.error('GD problematicas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una problemática { name, ref, description? }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { name, ref, description } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (!ref?.trim()) return NextResponse.json({ error: 'La referencia es requerida' }, { status: 400 });
    return NextResponse.json({ data: await createProblematica(name, ref, description) });
  } catch (err: any) {
    console.error('GD problematicas POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza una problemática { id, name?, ref?, description? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, name, ref, description } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateProblematica(Number(id), name, ref, description);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD problematicas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una problemática { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteProblematica(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD problematicas DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
