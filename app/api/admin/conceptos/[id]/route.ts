/** Un concepto: editar y borrar. Solo administradores. */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { editarConcepto, borrarConcepto } from '@/lib/soluciones';
import { ICONOS } from '@/components/sitio/piezas';

type Props = { params: Promise<{ id: string }> };

async function soloAdmin() {
  const user = await getCurrentUser();
  return !!user && user.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const { titulo, icono, descripcion } = await req.json();
  if (!titulo?.trim()) {
    return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
  }
  if (icono && !ICONOS[icono]) {
    return NextResponse.json({ error: 'Ese icono no existe en la galería' }, { status: 400 });
  }

  await editarConcepto(Number(id), {
    titulo: titulo.trim(),
    icono: icono || 'capas',
    descripcion: descripcion?.trim() || null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  await borrarConcepto(Number(id));
  return NextResponse.json({ ok: true });
}
