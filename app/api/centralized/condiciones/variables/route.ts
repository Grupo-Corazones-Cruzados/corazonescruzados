import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { addCondicionVariable, deleteCondicionVariable } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST — agrega una variable a una condición { condicion_id, kind, variable_id?, nombre?, factor?, causa? }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { condicion_id, kind, variable_id, nombre, factor, causa } = await req.json();
    if (!condicion_id) return NextResponse.json({ error: 'Falta condicion_id' }, { status: 400 });
    return NextResponse.json({ data: await addCondicionVariable(Number(condicion_id), { kind, variable_id, nombre, factor, causa }) });
  } catch (err: any) {
    console.error('Condiciones variables POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una variable de condición { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteCondicionVariable(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Condiciones variables DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
