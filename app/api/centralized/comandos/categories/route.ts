import { getCurrentUser } from '@/lib/auth/jwt';
import { listCategories, createCategory, deleteCategory } from '@/lib/centralized/comandos-db';
import { NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — lista de categorías (con conteo de políticas).
export async function GET() {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listCategories() });
  } catch (err: any) {
    console.error('Comandos categories GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una categoría { name }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    return NextResponse.json({ data: await createCategory(name) });
  } catch (err: any) {
    console.error('Comandos categories POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una categoría (y sus políticas en cascada) { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteCategory(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Comandos categories DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
