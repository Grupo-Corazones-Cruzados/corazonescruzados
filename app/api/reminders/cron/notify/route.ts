import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { runReminderEscalation } from '@/lib/reminders/escalation';

/**
 * Envía los correos escalados de recordatorios. Se invoca:
 *  1. Desde un cron externo con `x-cron-token` (Railway, cada ~10 min).
 *  2. Manualmente por un admin (para probar).
 */
export async function POST(req: NextRequest) {
  const viaCron = checkCronToken(req);
  if (!viaCron) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) {
        return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
  }
  try {
    const result = await runReminderEscalation();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('Reminders cron:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
