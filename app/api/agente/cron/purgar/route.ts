import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { purgarRetencionAgente } from '@/lib/agente/retencion';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST — RETENCIÓN del agente de WhatsApp.
 *
 * Borra la traza cruda de webhooks pasados los 30 días y los trabajos de cola ya
 * cerrados. Es lo que hace cierto el plazo publicado en `/legal/whatsapp` (A.8).
 *
 * Lo dispara el cron nocturno. Un admin logueado puede forzarlo a mano. Es idempotente.
 */
export async function POST(req: NextRequest) {
  if (!checkCronToken(req)) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      if (!cronTokenConfigured()) {
        return NextResponse.json({ error: 'Cron no configurado (falta CRON_TOKEN)' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Token de cron inválido' }, { status: 401 });
    }
  }
  try {
    const res = await purgarRetencionAgente();
    return NextResponse.json({ ok: true, ...res });
  } catch (err: any) {
    console.error('Agente purga:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
