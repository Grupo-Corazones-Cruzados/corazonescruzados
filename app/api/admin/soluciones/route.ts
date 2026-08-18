/**
 * ÁMBITOS — listar y crear. Solo administradores.
 *
 * Lo que se escribe aquí sale **publicado en la web**, en `/soluciones`. No es una tabla
 * interna: es contenido de cara al mundo, y por eso el acceso se comprueba con la misma
 * severidad que en el resto del panel.
 *
 * La web pública NO pasa por este endpoint: lee la base directamente al generar la página
 * (`lib/soluciones.ts`), igual que las preguntas frecuentes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listarSoluciones, crearSolucion, coberturaDeTalentos, talentosOcupados } from '@/lib/soluciones';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const soluciones = await listarSoluciones();

  // La cobertura solo se pide si se quiere: es una consulta más y la lista se recarga en
  // cada guardado. Se calcula para TODOS los talentos de una vez, no uno por solución.
  if (req.nextUrl.searchParams.get('cobertura') === '1') {
    const todos = [...new Set(soluciones.flatMap((a) => a.talentos.map((t) => t.talento)))];
    return NextResponse.json({
      data: soluciones,
      cobertura: await coberturaDeTalentos(todos),
      // Qué talento está cogido y por quién: el catálogo del panel los esconde.
      ocupados: await talentosOcupados(),
    });
  }
  return NextResponse.json({ data: soluciones });
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
  return NextResponse.json({ data: await crearSolucion(nombre.trim()) }, { status: 201 });
}
