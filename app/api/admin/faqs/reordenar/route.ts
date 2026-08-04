/**
 * REORDENAR las preguntas de una sección. Solo administradores.
 *
 * Recibe la lista completa de identificadores **en el orden deseado** y reescribe la columna
 * `orden` de arriba abajo. Se manda la lista entera y no «sube esta una posición» a
 * propósito: con posiciones relativas, dos pulsaciones seguidas antes de que responda la
 * primera dejan la lista en un estado que no es ninguno de los dos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { reordenarFaqs, faqsDeAcceso } from '@/lib/faqs';
import { accesoPorId } from '@/lib/sitio/contenido';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { acceso, ids } = await req.json();
  if (!accesoPorId(acceso)) {
    return NextResponse.json({ error: 'Esa sección no existe' }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'number')) {
    return NextResponse.json({ error: 'Se espera una lista de identificadores' }, { status: 400 });
  }

  await reordenarFaqs(acceso, ids);
  return NextResponse.json({ data: await faqsDeAcceso(acceso) });
}
