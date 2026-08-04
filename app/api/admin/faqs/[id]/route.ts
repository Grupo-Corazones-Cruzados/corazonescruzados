/**
 * UNA PREGUNTA FRECUENTE — editar y borrar. Solo administradores.
 * Ver la nota de `../route.ts`: esto se publica en la web.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { actualizarFaq, borrarFaq } from '@/lib/faqs';

type Ctx = { params: Promise<{ id: string }> };

async function soloAdmin() {
  const user = await getCurrentUser();
  return !!user && user.role === 'admin';
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const { pregunta, respuesta, orden } = await req.json();

  // Un texto en blanco no es «no lo cambies», es un error de quien escribe: se rechaza en
  // vez de guardar una pregunta vacía que luego aparecería en la web.
  if (pregunta !== undefined && !String(pregunta).trim()) {
    return NextResponse.json({ error: 'La pregunta no puede quedar vacía' }, { status: 400 });
  }
  if (respuesta !== undefined && !String(respuesta).trim()) {
    return NextResponse.json({ error: 'La respuesta no puede quedar vacía' }, { status: 400 });
  }

  const faq = await actualizarFaq(Number(id), {
    pregunta: pregunta?.trim(),
    respuesta: respuesta?.trim(),
    orden,
  });
  if (!faq) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  return NextResponse.json({ data: faq });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!await soloAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const ok = await borrarFaq(Number(id));
  if (!ok) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
