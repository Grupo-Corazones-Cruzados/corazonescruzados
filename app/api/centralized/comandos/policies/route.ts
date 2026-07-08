import { getCurrentUser } from '@/lib/auth/jwt';
import { createPolicy, setPolicyActive, deletePolicy } from '@/lib/centralized/comandos-db';
import { NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST — crea una política { category_id, name }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { category_id, name } = await req.json();
    if (!category_id) return NextResponse.json({ error: 'Falta category_id' }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    return NextResponse.json({ data: await createPolicy(Number(category_id), name) });
  } catch (err: any) {
    console.error('Comandos policies POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — activa/desactiva una política { id, active }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, active } = await req.json();
    if (!id || typeof active !== 'boolean') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    await setPolicyActive(Number(id), active);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Comandos policies PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una política (y sus funciones) { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deletePolicy(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Comandos policies DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
