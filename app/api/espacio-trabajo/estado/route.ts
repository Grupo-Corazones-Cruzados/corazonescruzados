import { NextResponse } from 'next/server';
import { espacioHabilitado, llamarServicio, sesionValida } from '@/lib/espacio-trabajo/guardia';

export const dynamic = 'force-dynamic';

/** La pestaña de Admin pregunta aquí: en la web responde 404 y la pestaña no aparece. */
export async function GET() {
  if (!espacioHabilitado()) return new NextResponse('Not Found', { status: 404 });
  let servicio = false;
  let claveConfigurada = false;
  try {
    const r = await llamarServicio('/estado');
    if (r.ok) { servicio = true; claveConfigurada = !!(await r.json()).claveConfigurada; }
  } catch { /* servicio apagado: lo dice `servicio: false` */ }
  return NextResponse.json({ servicio, claveConfigurada, autenticado: await sesionValida() });
}
