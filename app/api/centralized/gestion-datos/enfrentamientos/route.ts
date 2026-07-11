import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listEnfrentamientos, crearEnfrentamiento, updateEnfrentamiento, deleteEnfrentamiento } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — lista de enfrentamientos de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listEnfrentamientos(id) });
  } catch (err: any) {
    console.error('GD enfrentamientos GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea un enfrentamiento { problematica_id, fuente_a_id, fuente_b_id, texto }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, fuente_a_id, fuente_b_id, texto } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!fuente_a_id) return NextResponse.json({ error: 'Falta fuente_a_id' }, { status: 400 });
    if (!fuente_b_id) return NextResponse.json({ error: 'Falta fuente_b_id' }, { status: 400 });
    return NextResponse.json({ data: await crearEnfrentamiento(Number(problematica_id), Number(fuente_a_id), Number(fuente_b_id), texto) });
  } catch (err: any) {
    console.error('GD enfrentamientos POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualiza el texto de un enfrentamiento { id, texto }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, texto } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await updateEnfrentamiento(Number(id), texto);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD enfrentamientos PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un enfrentamiento { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteEnfrentamiento(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD enfrentamientos DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
