import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { startEvent, finishEvent } from '@/lib/centralized/gestion-social-db';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: user.userId };
}

/**
 * POST `{ action: 'start' | 'finish' }` — INICIO y FIN MANUALES del evento.
 *
 * Aunque el evento tenga fecha y hora asignadas, solo el usuario del sistema decide
 * cuándo empieza: hasta entonces las tareas tomadas siguen BLOQUEADAS en "Mi día".
 * Al finalizar, las tomas que sigan pendientes pasan automáticamente a `failed`
 * (y por tanto restan en la puntuación de talentos/valores).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const { id } = await params;
    const { action } = await req.json();
    if (action === 'start') {
      await startEvent(Number(id));
      return NextResponse.json({ ok: true });
    }
    if (action === 'finish') {
      const res = await finishEvent(Number(id));
      return NextResponse.json({ ok: true, ...res });
    }
    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch (err: any) {
    // Los errores de regla de negocio (estado incorrecto) son 409, no 500.
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
}
