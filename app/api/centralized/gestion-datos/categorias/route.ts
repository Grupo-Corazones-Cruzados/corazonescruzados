import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { listCategorias, crearCategoria, updateCategoria, deleteCategoria, setCategoriaCodigo } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — lista de categorías de una problemática.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    return NextResponse.json({ data: await listCategorias(id) });
  } catch (err: any) {
    console.error('GD categorias GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crea una categoría { problematica_id, nombre, codigo_ids }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { problematica_id, nombre, codigo_ids } = await req.json();
    if (!problematica_id) return NextResponse.json({ error: 'Falta problematica_id' }, { status: 400 });
    if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    return NextResponse.json({ data: await crearCategoria(Number(problematica_id), nombre, codigo_ids || []) });
  } catch (err: any) {
    console.error('GD categorias POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — renombra { id, nombre } o modifica códigos { id, action, codigo_id }.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id, nombre, action, codigo_id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    if (['add_codigo', 'remove_codigo'].includes(action)) {
      await setCategoriaCodigo(Number(id), Number(codigo_id), action === 'add_codigo');
    } else {
      await updateCategoria(Number(id), nombre);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD categorias PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina una categoría { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteCategoria(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD categorias DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
