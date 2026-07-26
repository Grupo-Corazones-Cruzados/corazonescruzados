import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listGlobalLists, getListOptions, addListOption, updateListOption, deleteListOption } from '@/lib/centralized/encuadre-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET → listas disponibles; GET ?list=key → opciones de esa lista (orden ascendente).
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const key = new URL(req.url).searchParams.get('list');
    if (key) return NextResponse.json({ data: await getListOptions(key) });
    return NextResponse.json({ data: await listGlobalLists() });
  } catch (err: any) {
    console.error('Encuadre listas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST { list, value } → agrega una opción.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { list, value } = await req.json();
    if (!list) return NextResponse.json({ error: 'Falta list' }, { status: 400 });
    if (!value?.trim()) return NextResponse.json({ error: 'Falta value' }, { status: 400 });
    return NextResponse.json({ data: await addListOption(list, value) });
  } catch (err: any) {
    console.error('Encuadre listas POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH { list, id, value } → renombra una opción.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { list, id, value } = await req.json();
    if (!list) return NextResponse.json({ error: 'Falta list' }, { status: 400 });
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    if (!value?.trim()) return NextResponse.json({ error: 'Falta value' }, { status: 400 });
    return NextResponse.json({ data: await updateListOption(list, Number(id), value) });
  } catch (err: any) {
    console.error('Encuadre listas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// DELETE { list, id } → elimina una opción.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { list, id } = await req.json();
    if (!list) return NextResponse.json({ error: 'Falta list' }, { status: 400 });
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    await deleteListOption(list, Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Encuadre listas DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
