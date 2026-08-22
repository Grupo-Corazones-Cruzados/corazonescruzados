/**
 * Los conceptos de un TALENTO: listar y crear. Solo administradores.
 *
 * ⚠️ Vivía en `/api/admin/soluciones/[id]/conceptos` hasta el 2026-08-21. Los conceptos
 * pasaron a colgar del talento (migración 051), así que la dirección lo dice: el recurso es
 * el talento, no la solución que lo contiene.
 *
 * Se direcciona por **slug** y no por el nombre del talento: el slug es único en toda la
 * tabla (migración 043), no lleva tildes ni espacios y es el mismo tramo que ya usa la web
 * pública en `/soluciones/<slug>`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { conceptosDeTalento, crearConcepto, talentoPorSlug } from '@/lib/soluciones';
import { ICONOS } from '@/components/sitio/piezas';

type Props = { params: Promise<{ slug: string }> };

async function soloAdmin() {
  const user = await getCurrentUser();
  return !!user && user.role === 'admin';
}

export async function GET(_req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { slug } = await params;
  const t = await talentoPorSlug(slug);
  if (!t) return NextResponse.json({ error: 'Ese talento no existe' }, { status: 404 });
  return NextResponse.json({ data: await conceptosDeTalento(t.talento) });
}

export async function POST(req: NextRequest, { params }: Props) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { slug } = await params;
  const { titulo, icono, descripcion } = await req.json();

  // El talento se resuelve ANTES de validar el resto: crear un concepto colgado de un
  // talento que no existe lo rechazaría la clave foránea con un 500 sin explicación.
  const t = await talentoPorSlug(slug);
  if (!t) return NextResponse.json({ error: 'Ese talento no existe' }, { status: 404 });

  if (!titulo?.trim()) {
    return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
  }
  // El icono se valida contra el mapa: uno inventado se pintaría con el de defecto y
  // nadie entendería por qué eligió otra cosa.
  if (icono && !ICONOS[icono]) {
    return NextResponse.json({ error: 'Ese icono no existe en la galería' }, { status: 400 });
  }

  const concepto = await crearConcepto(t.talento, {
    titulo: titulo.trim(),
    icono: icono || 'capas',
    descripcion: descripcion?.trim() || null,
  });
  return NextResponse.json({ data: concepto }, { status: 201 });
}
