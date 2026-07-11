import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listCodigos, crearCodigo, updateCodigo, deleteCodigo } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — lista de códigos de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listCodigos(id) });
  } catch (err: any) {
    console.error('GD codigos GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea un código { problematica_id, texto, unidades }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, texto, unidades } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!texto?.trim()) return NextResponse.json({ error: 'El texto es requerido' }, { status: 400 });
    return NextResponse.json({ data: await crearCodigo(Number(problematica_id), texto, unidades) });
  } catch (err: any) {
    console.error('GD codigos POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza un código { id, texto?, verificado? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, texto, verificado } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateCodigo(Number(id), texto, verificado);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD codigos PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un código { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteCodigo(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD codigos DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
