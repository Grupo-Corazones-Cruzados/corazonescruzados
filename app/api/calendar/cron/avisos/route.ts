import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { revisarAvisosPush } from '@/lib/calendar/avisos-push';

/**
 * Push de las reuniones de Mi día. Lo corre el servidor cada minuto (`instrumentation.ts`); este
 * endpoint es el RESPALDO del cron frecuente (cada 10 min). Idempotente: ver `lib/calendar/avisos-push.ts`.
 */
export async function POST(req: NextRequest) {
  if (!checkCronToken(req)) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
  }
  try {
    return NextResponse.json({ ok: true, ...(await revisarAvisosPush()) });
  } catch (err: any) {
    console.error('Avisos de reunión:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
