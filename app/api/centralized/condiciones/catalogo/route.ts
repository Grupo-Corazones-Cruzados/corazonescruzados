import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listVariablesCatalogo, createVariableCatalogo, deleteVariableCatalogo } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — catálogo de variables.
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listVariablesCatalogo() });
  } catch (err: any) {
    console.error('Condiciones catalogo GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una variable de catálogo { factor, causa, nombre }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { factor, causa, nombre } = await req.json();
    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    return NextResponse.json({ data: await createVariableCatalogo(factor, causa, nombre) });
  } catch (err: any) {
    console.error('Condiciones catalogo POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una variable de catálogo { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteVariableCatalogo(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Condiciones catalogo DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
