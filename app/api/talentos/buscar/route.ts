import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { searchTalentos } from '@/lib/talentos/embeddings';

export const dynamic = 'force-dynamic';

/**
 * Búsqueda semántica de talentos. La consume la herramienta `buscar_talentos` del AGENTE
 * de cotizaciones (worker), que se identifica con el token compartido del worker; así el
 * worker no necesita la clave de OpenAI: las claves de IA se quedan en la app.
 * También responde a usuarios con sesión (por si se usa desde la interfaz).
 */
export async function POST(req: NextRequest) {
  try {
    const workerToken = process.env.COTIZADOR_WORKER_TOKEN || '';
    const sent = req.headers.get('x-worker-token') || '';
    const fromWorker = Boolean(workerToken) && sent === workerToken;

    if (!fromWorker) {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const b = await req.json().catch(() => ({}));
    const query = String(b?.query ?? '').trim();
    if (!query) return NextResponse.json({ error: 'Falta la consulta.' }, { status: 400 });
    const k = Math.min(Math.max(Number(b?.k) || 8, 1), 25);

    return NextResponse.json({ data: await searchTalentos(query, k) });
  } catch (err: any) {
    console.error('Buscar talentos:', err.message);
    return NextResponse.json({ error: 'No se pudo buscar talentos.' }, { status: 500 });
  }
}
