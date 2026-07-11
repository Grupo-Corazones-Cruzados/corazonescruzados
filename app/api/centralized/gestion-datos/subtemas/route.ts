import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listSubtemas, crearSubtema, updateSubtema, deleteSubtema } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — lista de subtemas de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listSubtemas(id) });
  } catch (err: any) {
    console.error('GD subtemas GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea un subtema { problematica_id, titulo, hipotesis, rompecabezas_ids }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, titulo, hipotesis, rompecabezas_ids } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!titulo?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    return NextResponse.json({ data: await crearSubtema(Number(problematica_id), titulo, hipotesis || [], rompecabezas_ids || []) });
  } catch (err: any) {
    console.error('GD subtemas POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza un subtema { id, titulo?, hipotesis?, rompecabezas_ids? }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, titulo, hipotesis, rompecabezas_ids } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateSubtema(Number(id), titulo, hipotesis, rompecabezas_ids);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD subtemas PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un subtema { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteSubtema(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD subtemas DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
