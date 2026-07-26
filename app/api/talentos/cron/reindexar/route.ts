import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { reindexPending, countPending, embeddingsConfigured } from '@/lib/talentos/embeddings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST — TRABAJO NOCTURNO: pone al día los embeddings de la lista de talentos.
 *
 * Reindexa los talentos NUEVOS (sin vector) y los RENOMBRADOS (el texto con el que se
 * calculó el vector ya no coincide con el nombre actual). Es idempotente: si no hay nada
 * pendiente no gasta ni una llamada a la API.
 *
 * Sin esto la puesta al día igual ocurre —la búsqueda del agente reindexa lo pendiente
 * sobre la marcha—, pero entonces la paga la primera cotización de la mañana. Hacerlo de
 * noche deja la lista lista de antemano.
 *
 * Autorización: secreto compartido `CRON_TOKEN` (`x-cron-token`) o un admin logueado.
 */
export async function POST(req: NextRequest) {
  if (!checkCronToken(req)) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) {
        return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      }
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  try {
    if (!embeddingsConfigured()) {
      return NextResponse.json({ error: 'Falta OPENAI_API_KEY: no se pueden calcular embeddings.' }, { status: 503 });
    }
    const pendientes = await countPending();
    const indexed = await reindexPending();
    return NextResponse.json({ ok: true, pendientes, indexados: indexed });
  } catch (err: any) {
    console.error('Cron talentos reindex:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
