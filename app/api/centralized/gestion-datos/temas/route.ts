import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listTemas, crearTema, updateTema, deleteTema } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — temas de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listTemas(id) });
  } catch (err: any) {
    console.error('GD temas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea un tema { problematica_id, titulo, prosa, subtema_ids, materia_ids, problema_ids }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, titulo, prosa, subtema_ids, materia_ids, problema_ids } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!titulo?.trim()) return NextResponse.json({ error: 'Falta titulo' }, { status: 400 });
    const data = await crearTema(problematica_id, titulo, prosa || '', subtema_ids || [], materia_ids || [], problema_ids || []);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('GD temas POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza un tema { id, titulo?, prosa?, subtema_ids?, materia_ids?, problema_ids? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, titulo, prosa, subtema_ids, materia_ids, problema_ids } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    await updateTema(id, titulo, prosa, subtema_ids, materia_ids, problema_ids);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD temas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un tema { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    await deleteTema(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD temas DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
