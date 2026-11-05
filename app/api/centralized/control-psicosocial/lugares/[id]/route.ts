import { NextResponse } from 'next/server';
import { borrarLugar, datosDeLugar, editarLugar, miembroDeSesion } from '@/lib/centralized/control-psicosocial-db';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const m = await miembroDeSesion();
  if (!m?.isAdmin) return NextResponse.json({ error: 'Solo los administradores' }, { status: 403 });
  const id = Number((await params).id);
  const datos = datosDeLugar(await req.json().catch(() => ({})));
  if (!Number.isInteger(id) || !datos) return NextResponse.json({ error: 'Revisa el nombre, el punto y el radio' }, { status: 400 });
  try {
    if (!(await editarLugar(id, datos))) return NextResponse.json({ error: 'No existe' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Editar lugar:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const m = await miembroDeSesion();
  if (!m?.isAdmin) return NextResponse.json({ error: 'Solo los administradores' }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  try {
    if (!(await borrarLugar(id))) return NextResponse.json({ error: 'No existe' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Borrar lugar:', err.message);
    return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 });
  }
}
