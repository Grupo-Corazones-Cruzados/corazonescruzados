import { getCurrentUser } from '@/lib/auth/jwt';
import { requeueCaptura } from '@/lib/centralized/percepcion-db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// En el modelo "worker local", el servidor NO ejecuta el Claude CLI. Este endpoint solo (re)encola la
// captura como 'pendiente' para que el worker local la tome y la analice. Lo usa el botón
// "Analizar"/"Reintentar" de la UI. El análisis real ocurre en scripts/percepcion-worker.mjs.
async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId, isAdmin: user.role === 'admin' };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const ok = await requeueCaptura(Number(id), g.userId, g.isAdmin);
    if (!ok) return NextResponse.json({ error: 'Captura no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true, estado: 'pendiente' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
