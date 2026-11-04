import { NextResponse } from 'next/server';
import { cerrarAuxilio, miembroDeLlamada } from '@/lib/centralized/control-psicosocial-db';

/** Cerrar un auxilio: quien lo pidió o el admin. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await miembroDeLlamada(req);
  if (!m) return NextResponse.json({ error: 'Solo para miembros' }, { status: 403 });
  if (m.suplantado) return NextResponse.json({ error: 'Solo lo puede cerrar la propia persona' }, { status: 403 });
  const id = Number((await params).id);
  const { motivo } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || (motivo !== 'resuelta' && motivo !== 'falsa')) {
    return NextResponse.json({ error: 'Datos no válidos' }, { status: 400 });
  }
  try {
    if (!(await cerrarAuxilio(m, id, motivo))) {
      return NextResponse.json({ error: 'No existe, ya está cerrado o no puedes cerrarlo' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Cerrar auxilio:', err.message);
    return NextResponse.json({ error: 'No se pudo cerrar' }, { status: 500 });
  }
}
