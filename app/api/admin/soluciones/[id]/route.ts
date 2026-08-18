/** Una solución: renombrar y borrar. Solo administradores. */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { renombrarSolucion, borrarSolucion } from '@/lib/soluciones';

type Props = { params: Promise<{ id: string }> };

async function soloAdmin() {
  const user = await getCurrentUser();
  return !!user && user.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const { nombre } = await req.json();
  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }
  // ⚠️ Renombrar NO cambia el `slug`: es una URL ya repartida. Ver `lib/soluciones.ts`.
  await renombrarSolucion(Number(id), nombre.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  await borrarSolucion(Number(id));
  return NextResponse.json({ ok: true });
}
