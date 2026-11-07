import { NextRequest, NextResponse } from 'next/server';
import { crearSesion, sesionesDelEquipo, sesionPublica } from '@/lib/presupuestos/db';
import { iaConfigurada } from '@/lib/ia/openai';

/** Las sesiones del agente de presupuestos de este equipo, y abrir una nueva. Es público. */
export const dynamic = 'force-dynamic';
const SOLUCIONES = new Set(['tecnologia']);

export async function GET(req: NextRequest) {
  const solucion = req.nextUrl.searchParams.get('solucion') ?? '';
  if (!SOLUCIONES.has(solucion)) return NextResponse.json({ error: 'Solución no válida' }, { status: 400 });
  return NextResponse.json(await sesionesDelEquipo(solucion), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const { solucion } = await req.json().catch(() => ({}));
  if (!SOLUCIONES.has(solucion)) return NextResponse.json({ error: 'Solución no válida' }, { status: 400 });
  if (!iaConfigurada()) return NextResponse.json({ error: 'El agente no está disponible por ahora.' }, { status: 503 });
  const r = await crearSesion(solucion);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.estado });
  return NextResponse.json({ sesion: sesionPublica(r.sesion) }, { status: 201 });
}
