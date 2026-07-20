import { NextResponse } from 'next/server';
import { getAuthedClient } from '@/lib/world/auth';
import { evaluateStages } from '@/lib/game/stages';
import { getBalance } from '@/lib/game/ledger';

// GET: qué etapas tiene abiertas el jugador y qué le falta para las demás.
//
// El juego PREGUNTA qué tiene abierto; nunca informa de que cumplió una
// condición. Toda la evaluación ocurre aquí, contra las tablas reales.
export async function GET() {
  try {
    const me = await getAuthedClient();
    if (!me) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const [stages, fichas] = await Promise.all([evaluateStages(me.id), getBalance(me.id, 'ficha')]);

    return NextResponse.json({
      stages,
      balances: { ficha: fichas },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
