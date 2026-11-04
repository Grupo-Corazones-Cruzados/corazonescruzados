import { NextResponse } from 'next/server';
import { llamarServicio, rechazo } from '@/lib/espacio-trabajo/guardia';

export const dynamic = 'force-dynamic';

/** Paso al servicio local. El acceso tiene su ruta propia: por aquí no se comprueban contraseñas. */
async function pasar(req: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const { ruta } = await params;
  if (ruta[0] === 'acceso') return new NextResponse('Not Found', { status: 404 });
  const destino = `/${ruta.map(encodeURIComponent).join('/')}${new URL(req.url).search}`;
  try {
    const r = await llamarServicio(destino, {
      method: req.method, signal: req.signal,
      // En bytes: un adjunto pasado por `text()` llegaría corrupto.
      body: req.method === 'GET' ? undefined : await req.arrayBuffer(),
    });
    return new Response(r.body, {
      status: r.status,
      headers: {
        'Content-Type': r.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ error: 'El servicio local no está en marcha.', codigo: 'sin_servicio', detalle: String(e) }, { status: 503 });
  }
}

export { pasar as GET, pasar as POST, pasar as PATCH, pasar as DELETE };
