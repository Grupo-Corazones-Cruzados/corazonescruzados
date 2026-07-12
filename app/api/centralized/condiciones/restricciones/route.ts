import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { addCondicionRestriccion, deleteCondicionRestriccion } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST — agrega una restricción a una condición { condicion_id, tipo, config }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { condicion_id, tipo, config } = await req.json();
    if (!condicion_id) return NextResponse.json({ error: 'Falta condicion_id' }, { status: 400 });
    if (!tipo?.trim()) return NextResponse.json({ error: 'El tipo es requerido' }, { status: 400 });
    return NextResponse.json({ data: await addCondicionRestriccion(Number(condicion_id), tipo, config || {}) });
  } catch (err: any) {
    console.error('Condiciones restricciones POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una restricción de condición { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteCondicionRestriccion(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Condiciones restricciones DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
