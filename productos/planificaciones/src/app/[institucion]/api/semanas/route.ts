import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** El estado de las semanas de una planificación: lo consulta la pantalla mientras el agente redacta. */
export async function GET(peticion: Request, { params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const ctx = await contextoApi(institucion, 'ver');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });
  const planificacionId = Number(new URL(peticion.url).searchParams.get('planificacion'));
  const semanas = await prisma.planificacionSemanal.findMany({
    where: { inquilinoId: ctx.inquilino.id, planificacionId },
    select: { id: true, estado: true },
  });
  return NextResponse.json({ semanas });
}
