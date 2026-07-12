import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { createReqTicket, createReqProject, unlinkEntregable } from '@/lib/centralized/condiciones-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST — crea un ticket/proyecto real (usuario=cliente) bajo un requerimiento.
// { requerimiento_id, kind:'ticket'|'project', titulo, descripcion?, member_id? }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'member'].includes(user.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { requerimiento_id, kind, titulo, descripcion, member_id } = await req.json();
    if (!requerimiento_id) return NextResponse.json({ error: 'Falta requerimiento_id' }, { status: 400 });
    if (!['ticket', 'project'].includes(kind)) return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
    if (!titulo?.trim()) return NextResponse.json({ error: 'Falta titulo' }, { status: 400 });
    const mid = member_id ? Number(member_id) : null;
    const data = kind === 'ticket'
      ? await createReqTicket(user.userId, requerimiento_id, titulo, descripcion || '', mid)
      : await createReqProject(user.userId, requerimiento_id, titulo, descripcion || '', mid);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('GC entregables POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — desvincula un ticket/proyecto del requerimiento (no borra el ticket/proyecto).
export async function DELETE(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { kind, ref_id } = await req.json();
    if (!['ticket', 'project'].includes(kind)) return NextResponse.json({ error: 'kind inválido' }, { status: 400 });
    if (!ref_id) return NextResponse.json({ error: 'Falta ref_id' }, { status: 400 });
    await unlinkEntregable(kind, Number(ref_id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('GC entregables DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
