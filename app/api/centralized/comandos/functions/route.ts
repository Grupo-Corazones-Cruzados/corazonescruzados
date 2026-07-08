import { getCurrentUser } from '@/lib/auth/jwt';
import { createFunction, updateFunctionConfig, getFunction, deleteFunction } from '@/lib/centralized/comandos-db';
import { FUNCTION_ACTIONS } from '@/lib/centralized/comandos';
import { NextResponse } from 'next/server';

const VALID = new Set(FUNCTION_ACTIONS.map((a) => a.key));

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?id= — una función con su config (para editar).
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    return NextResponse.json({ data: await getFunction(id) });
  } catch (err: any) {
    console.error('Comandos functions GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una función { policy_id, type, config }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { policy_id, type, config } = await req.json();
    if (!policy_id) return NextResponse.json({ error: 'Falta policy_id' }, { status: 400 });
    if (!VALID.has(type)) return NextResponse.json({ error: 'Tipo de función inválido' }, { status: 400 });
    return NextResponse.json({ data: await createFunction(Number(policy_id), type, config) });
  } catch (err: any) {
    console.error('Comandos functions POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza la config de una función { id, config }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, config } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateFunctionConfig(Number(id), config);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Comandos functions PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una función { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteFunction(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Comandos functions DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
