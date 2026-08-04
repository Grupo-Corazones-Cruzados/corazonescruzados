/**
 * PREGUNTAS FRECUENTES — listar y crear. Solo administradores.
 *
 * Lo que se escribe aquí sale **publicado en la web**, en `/negocio/<acceso>`. No es una
 * tabla interna: es contenido de cara al mundo, y por eso el acceso se comprueba con la
 * misma severidad que en el resto del panel.
 *
 * La web pública NO pasa por este endpoint: lee la base directamente al generar la página
 * (`lib/faqs.ts`). Sería absurdo que la aplicación se llamara a sí misma por HTTP para leer
 * su propia base.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { faqsDeAcceso, conteoPorAcceso, crearFaq } from '@/lib/faqs';
import { accesoPorId } from '@/lib/sitio/contenido';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const acceso = req.nextUrl.searchParams.get('acceso');

  // Sin `acceso`: solo los conteos, para las burbujas del rail.
  if (!acceso) return NextResponse.json({ conteos: await conteoPorAcceso() });

  if (!accesoPorId(acceso)) {
    return NextResponse.json({ error: 'Esa sección no existe' }, { status: 404 });
  }
  return NextResponse.json({ data: await faqsDeAcceso(acceso) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { acceso, pregunta, respuesta } = await req.json();

  // La sección tiene que ser una de las cinco de verdad. Sin esto, un `acceso` mal escrito
  // guarda una pregunta que no se vería nunca en ninguna página, y nadie sabría por qué.
  if (!accesoPorId(acceso)) {
    return NextResponse.json({ error: 'Esa sección no existe' }, { status: 400 });
  }
  if (!pregunta?.trim() || !respuesta?.trim()) {
    return NextResponse.json({ error: 'La pregunta y la respuesta son obligatorias' }, { status: 400 });
  }

  const faq = await crearFaq({
    accesoId: acceso,
    pregunta: pregunta.trim(),
    respuesta: respuesta.trim(),
  });
  return NextResponse.json({ data: faq }, { status: 201 });
}
