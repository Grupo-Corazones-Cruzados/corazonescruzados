import { claimForWorker } from '@/lib/centralized/percepcion-db';
import { checkWorkerToken, workerTokenConfigured } from '@/lib/centralized/percepcion-worker';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// El worker local reclama capturas pendientes (marca 'analizando') y recibe sus fotos (URLs) para
// analizarlas con el Claude CLI. Auth por token compartido (x-worker-token).
export async function GET(req: NextRequest) {
  if (!workerTokenConfigured()) return NextResponse.json({ error: 'Worker no configurado (falta PERCEPCION_WORKER_TOKEN)' }, { status: 503 });
  if (!checkWorkerToken(req)) return NextResponse.json({ error: 'Token de worker inválido' }, { status: 401 });
  try {
    const limit = Number(new URL(req.url).searchParams.get('limit')) || 3;
    const capturas = await claimForWorker(limit);
    return NextResponse.json({ capturas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
