import { setCapturaResultado, setCapturaError, type PsElementoInput } from '@/lib/centralized/percepcion-db';
import { checkWorkerToken, workerTokenConfigured } from '@/lib/centralized/percepcion-worker';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CATS = new Set(['objeto', 'animal', 'persona']);

// El worker local devuelve el análisis de una captura: {captura_id, resumen, elementos} en éxito, o
// {captura_id, error} si falló. Auth por token compartido (x-worker-token). El servidor normaliza y
// persiste (no confía ciegamente en la forma del payload).
export async function POST(req: NextRequest) {
  if (!workerTokenConfigured()) return NextResponse.json({ error: 'Worker no configurado' }, { status: 503 });
  if (!checkWorkerToken(req)) return NextResponse.json({ error: 'Token de worker inválido' }, { status: 401 });
  try {
    const body = await req.json();
    const capturaId = Number(body?.captura_id);
    if (!Number.isInteger(capturaId)) return NextResponse.json({ error: 'captura_id inválido' }, { status: 400 });

    if (body?.error) {
      await setCapturaError(capturaId, String(body.error));
      return NextResponse.json({ ok: true });
    }

    const elementos: PsElementoInput[] = (Array.isArray(body?.elementos) ? body.elementos : [])
      .filter((e: any) => e && e.nombre)
      .map((e: any) => {
        const cat = String(e.categoria || '').toLowerCase();
        return {
          categoria: (CATS.has(cat) ? cat : 'objeto') as PsElementoInput['categoria'],
          nombre: String(e.nombre).slice(0, 120),
          confianza: e.confianza != null && Number.isFinite(Number(e.confianza)) ? Math.max(0, Math.min(100, Math.round(Number(e.confianza)))) : null,
          resumen: e.resumen != null ? String(e.resumen).slice(0, 400) : null,
          propiedades: e.propiedades && typeof e.propiedades === 'object' && !Array.isArray(e.propiedades) ? e.propiedades : {},
          foto_indices: Array.isArray(e.foto_indices) ? e.foto_indices.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n)) : [],
        };
      });

    await setCapturaResultado(capturaId, String(body?.resumen || '').slice(0, 600), elementos);
    return NextResponse.json({ ok: true, elementos: elementos.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
