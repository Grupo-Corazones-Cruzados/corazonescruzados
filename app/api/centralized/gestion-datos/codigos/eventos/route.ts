import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { addCodigoEvento, deleteCodigoEvento } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST — agrega un evento a un código { codigo_id, titulo, url }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { codigo_id, titulo, url } = await req.json();
    if (!codigo_id) return NextResponse.json({ error: 'Falta codigo_id' }, { status: 400 });
    if (!titulo?.trim()) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    if (!url?.trim()) return NextResponse.json({ error: 'La url es requerida' }, { status: 400 });
    return NextResponse.json({ data: await addCodigoEvento(Number(codigo_id), titulo, url) });
  } catch (err: any) {
    console.error('GD codigos eventos POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un evento de código { id }.
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 });
    await deleteCodigoEvento(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GD codigos eventos DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
