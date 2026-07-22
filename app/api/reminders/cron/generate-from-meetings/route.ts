import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { runMeetingReminderGeneration } from '@/lib/reminders/meeting-gen';

/**
 * Genera recordatorios desde las reuniones de Meet terminadas (transcripción → IA). Se invoca
 * desde el cron externo (`x-cron-token`) o manualmente por un admin.
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
    const result = await runMeetingReminderGeneration();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('Meeting reminders cron:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
