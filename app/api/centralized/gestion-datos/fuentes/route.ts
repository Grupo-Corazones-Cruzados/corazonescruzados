import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listFuentes, createFuente, updateFuente, deleteFuente } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — lista de fuentes de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listFuentes(id) });
  } catch (err: any) {
    console.error('GD fuentes GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una fuente { problematica_id, tipo_dato, tipo_logica, contenido, credibilidad }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, tipo_dato, tipo_logica, contenido, credibilidad } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!['cantidad', 'cualidad'].includes(tipo_dato)) return NextResponse.json({ error: 'tipo_dato inválido' }, { status: 400 });
    if (!['premisa', 'peso'].includes(tipo_logica)) return NextResponse.json({ error: 'tipo_logica inválido' }, { status: 400 });
    return NextResponse.json({ data: await createFuente(Number(problematica_id), tipo_dato, tipo_logica, contenido, credibilidad) });
  } catch (err: any) {
    console.error('GD fuentes POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza una fuente { id, contenido?, credibilidad? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, contenido, credibilidad } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateFuente(Number(id), contenido, credibilidad);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD fuentes PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una fuente { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteFuente(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD fuentes DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
