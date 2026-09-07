import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { listFuentesDisponibles, listProblematicasParaFuentes } from '@/lib/centralized/generacion-contenido-db';

// Lectura de Gestión de Datos para elegir FUENTES DE CONOCIMIENTO. SOLO LECTURA: aquí no se
// edita la investigación de nadie, solo se marca lo que el video va a citar.
// Sin `problematica_id` devuelve las problemáticas (el filtro del panel).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ data: { problematicas: await listProblematicasParaFuentes() } });
    const data = await listFuentesDisponibles(id);
    if (!data) return NextResponse.json({ error: 'Problemática no encontrada' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Generación de contenido fuentes error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
