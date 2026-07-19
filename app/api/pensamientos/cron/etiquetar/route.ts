import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { runTagging } from '@/lib/centralized/pensamientos-runner';

export const dynamic = 'force-dynamic';
/** El lote puede tardar: se permite hasta 5 min de ejecución. */
export const maxDuration = 300;

/**
 * POST — ejecuta el etiquetado por IA de los pensamientos sin categoría.
 *
 * Dos formas de autorización:
 *  1. **Cron externo** con el secreto compartido `CRON_TOKEN` (cabecera `x-cron-token`).
 *     Es el disparo nocturno de la 01:00 (America/Guayaquil) = 06:00 UTC en Railway.
 *  2. **Admin logueado**, para poder forzarlo a mano ("Etiquetar ahora") sin depender del cron.
 *
 * Es idempotente: solo toca los pensamientos con `category IS NULL`, así que repetirlo no
 * duplica trabajo y una noche perdida se recupera en la siguiente ejecución.
 */
export async function POST(req: NextRequest) {
  const viaCron = checkCronToken(req);
  let trigger: 'cron' | 'manual' = 'cron';

  if (!viaCron) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      // Si nadie configuró el token, dilo claro (fail-closed pero diagnosticable).
      if (!cronTokenConfigured()) {
        return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
    trigger = 'manual';
  }

  try {
    const result = await runTagging(trigger);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('Pensamientos cron:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
