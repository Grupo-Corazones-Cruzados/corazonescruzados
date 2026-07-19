import { NextRequest, NextResponse } from 'next/server';
import { cronTokenConfigured, checkCronToken } from '@/lib/cron-auth';
import { getCurrentUser } from '@/lib/auth/jwt';
import { purgeExpiredMessages } from '@/lib/chat/chat-db';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST — RETENCIÓN del chat: borra los mensajes que superan la retención de su conversación.
 *
 * Solo afecta a las conversaciones **temporales** (las de ticket/proyecto/experiencia, con
 * `retention_days = 30`). El chat grupal tiene `retention_days = NULL` y nunca se purga.
 *
 * Autorización idéntica a la del etiquetado nocturno: secreto compartido `CRON_TOKEN`
 * (cabecera `x-cron-token`) o un admin logueado para forzarlo a mano. Es idempotente:
 * repetirlo no borra nada nuevo.
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
    const res = await purgeExpiredMessages();
    return NextResponse.json({ ok: true, ...res });
  } catch (err: any) {
    console.error('Chat purga:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
