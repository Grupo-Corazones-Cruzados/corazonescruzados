/**
 * ÁMBITOS — listar y crear. Solo administradores.
 *
 * Lo que se escribe aquí sale **publicado en la web**, en `/soluciones`. No es una tabla
 * interna: es contenido de cara al mundo, y por eso el acceso se comprueba con la misma
 * severidad que en el resto del panel.
 *
 * La web pública NO pasa por este endpoint: lee la base directamente al generar la página
 * (`lib/ambitos.ts`), igual que las preguntas frecuentes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listarAmbitos, crearAmbito, coberturaDeTalentos, talentosOcupados } from '@/lib/ambitos';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const ambitos = await listarAmbitos();

  // La cobertura solo se pide si se quiere: es una consulta más y la lista se recarga en
  // cada guardado. Se calcula para TODOS los talentos de una vez, no uno por ámbito.
  if (req.nextUrl.searchParams.get('cobertura') === '1') {
    const todos = [...new Set(ambitos.flatMap((a) => a.talentos.map((t) => t.talento)))];
    return NextResponse.json({
      data: ambitos,
      cobertura: await coberturaDeTalentos(todos),
      // Qué talento está cogido y por quién: el catálogo del panel los esconde.
      ocupados: await talentosOcupados(),
    });
  }
  return NextResponse.json({ data: ambitos });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { nombre } = await req.json();
  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }
  return NextResponse.json({ data: await crearAmbito(nombre.trim()) }, { status: 201 });
}
