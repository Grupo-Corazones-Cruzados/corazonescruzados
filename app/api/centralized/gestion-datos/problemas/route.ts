import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listProblemas, createProblema, updateProblema, deleteProblema } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — lista de problemas de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listProblemas(id) });
  } catch (err: any) {
    console.error('GD problemas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea un problema { problematica_id, title, description? }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, title, description } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    return NextResponse.json({ data: await createProblema(Number(problematica_id), title, description) });
  } catch (err: any) {
    console.error('GD problemas POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza un problema { id, title?, description? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, title, description } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateProblema(Number(id), title, description);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD problemas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un problema { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteProblema(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD problemas DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
