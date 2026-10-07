import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { avisarSuscripcionesPorVencer } from '@/lib/avisos-suscripciones';

/**
 * Avisos de suscripciones por vencer (al cliente y a quien la ofreció). Lo llama el cron
 * frecuente (`scripts/frequent-cron.mjs`, cada 10 min) con `x-cron-token`, o un admin a mano.
 * Cada aviso sale una sola vez: ver `lib/avisos-suscripciones.ts`.
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
    // `?simular=1` (admin): qué se enviaría hoy, sin enviar ni guardar nada.
    const simular = req.nextUrl.searchParams.get('simular') === '1';
    return NextResponse.json({ ok: true, ...(await avisarSuscripcionesPorVencer(simular)) });
  } catch (err: any) {
    console.error('Avisos de suscripción:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
