import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { rechazo } from '@/lib/espacio-trabajo/guardia';

export const dynamic = 'force-dynamic';

const NUCLEO = process.env['COPILOTO_URL'] || 'http://127.0.0.1:3793';
const RUTAS = new Set(['audio', 'eventos', 'estado', 'activar', 'desactivar', 'terminar', 'detener', 'consulta']);
const tokenNucleo = () => fs.readFileSync(process.env['COPILOTO_TOKEN'] || path.join(os.homedir(), '.gcc-copiloto/token'), 'utf8').trim();

/**
 * El teléfono habla con el núcleo de Gumdramon a través de la web local, con el mismo candado que el
 * Espacio de trabajo. El núcleo sigue escuchando solo en esta Mac y su token no sale de aquí.
 */
async function pasar(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const { ruta } = await params;
  if (ruta.length !== 1 || !RUTAS.has(ruta[0])) return new NextResponse('Not Found', { status: 404 });
  try {
    const r = await fetch(`${NUCLEO}/${ruta[0]}${new URL(req.url).search}`, {
      method: req.method, signal: req.signal, cache: 'no-store',
      headers: { Authorization: `Bearer ${tokenNucleo()}` },
      body: req.method === 'GET' ? undefined : await req.arrayBuffer(),
    });
    return new Response(r.body, {
      status: r.status,
      headers: { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    });
  } catch {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ error: 'El núcleo de Gumdramon no responde en la Mac.' }, { status: 503 });
  }
}

export { pasar as GET, pasar as POST };
