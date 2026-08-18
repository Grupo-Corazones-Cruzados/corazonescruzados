/** Los conceptos de una solución: listar y crear. Solo administradores. */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { conceptosDeSolucion, crearConcepto } from '@/lib/soluciones';
import { ICONOS } from '@/components/sitio/piezas';

type Props = { params: Promise<{ id: string }> };

async function soloAdmin() {
  const user = await getCurrentUser();
  return !!user && user.role === 'admin';
}

export async function GET(_req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  return NextResponse.json({ data: await conceptosDeSolucion(Number(id)) });
}

export async function POST(req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const { titulo, icono, descripcion } = await req.json();

  if (!titulo?.trim()) {
    return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
  }
  // El icono se valida contra el mapa: uno inventado se pintaría con el de defecto y
  // nadie entendería por qué eligió otra cosa.
  if (icono && !ICONOS[icono]) {
    return NextResponse.json({ error: 'Ese icono no existe en la galería' }, { status: 400 });
  }

  const concepto = await crearConcepto(Number(id), {
    titulo: titulo.trim(),
    icono: icono || 'capas',
    descripcion: descripcion?.trim() || null,
  });
  return NextResponse.json({ data: concepto }, { status: 201 });
}
