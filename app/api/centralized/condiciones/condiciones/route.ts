import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listCondiciones, createCondicion, updateCondicion, deleteCondicion } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — condiciones de una pieza ?pieza_id=.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('pieza_id'));
    if (!id) return NextResponse.json({ error: 'Falta pieza_id' }, { status: 400 });
    return NextResponse.json({ data: await listCondiciones(id) });
  } catch (err: any) {
    console.error('Condiciones condiciones GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una condición { pieza_id, nombre }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { pieza_id, nombre } = await req.json();
    if (!pieza_id) return NextResponse.json({ error: 'Falta pieza_id' }, { status: 400 });
    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    return NextResponse.json({ data: await createCondicion(Number(pieza_id), nombre) });
  } catch (err: any) {
    console.error('Condiciones condiciones POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza una condición { id, nombre?, verificada? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, nombre, verificada } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateCondicion(Number(id), nombre, verificada);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Condiciones condiciones PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una condición { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteCondicion(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Condiciones condiciones DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
