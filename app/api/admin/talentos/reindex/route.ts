import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { reindexPending, embeddingsConfigured } from '@/lib/talentos/embeddings';

export const dynamic = 'force-dynamic';

/**
 * Recalcula los embeddings que falten (talentos nuevos o renombrados). Normalmente no hace
 * falta llamarlo: la propia búsqueda reindexa lo pendiente. Queda como botón de emergencia.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (!embeddingsConfigured()) {
      return NextResponse.json({ error: 'Falta OPENAI_API_KEY: no se pueden calcular embeddings.' }, { status: 400 });
    }
    return NextResponse.json({ data: { indexed: await reindexPending() } });
  } catch (err: any) {
    console.error('Reindex talentos:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
