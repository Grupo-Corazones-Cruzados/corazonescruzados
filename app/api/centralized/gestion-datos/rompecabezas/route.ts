import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listRompecabezas, crearRompecabezas, updateRompecabezas, deleteRompecabezas } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — lista de rompecabezas de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listRompecabezas(id) });
  } catch (err: any) {
    console.error('GD rompecabezas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea un rompecabezas { problematica_id, nombre, situacion_id, pieza_ids }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, nombre, situacion_id, pieza_ids } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    return NextResponse.json({ data: await crearRompecabezas(Number(problematica_id), nombre, situacion_id ?? null, pieza_ids || []) });
  } catch (err: any) {
    console.error('GD rompecabezas POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza un rompecabezas { id, nombre?, situacion_id?, pieza_ids? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const body = await req.json();
    const { id, nombre, situacion_id, pieza_ids } = body;
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateRompecabezas(Number(id), nombre, ('situacion_id' in body) ? situacion_id : undefined, pieza_ids);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD rompecabezas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un rompecabezas { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteRompecabezas(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD rompecabezas DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
