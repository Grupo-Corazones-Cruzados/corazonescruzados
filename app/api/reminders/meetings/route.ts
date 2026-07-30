import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import {
  scanUserMeetings,
  generateReminderFromRecord,
  normalizeDays,
  MeetingScanError,
} from '@/lib/reminders/meeting-scan';

/**
 * Reuniones de Meet del usuario (últimos N días) para generar recordatorios A MANO desde el
 * módulo Recordatorios. Cubre las reuniones **instantáneas** ("iniciar ahora"), que no son
 * eventos del calendario, y también las agendadas cuyo pase automático no alcanzó a correr.
 *
 * GET  ?days=7          → lista de candidatas con su estado (lista / sin transcripción / ya generada)
 * POST { recordName }   → genera el recordatorio de esa reunión (idempotente)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const days = normalizeDays(req.nextUrl.searchParams.get('days'));
    const { candidates, note } = await scanUserMeetings(user.userId, days);
    return NextResponse.json({ data: candidates, days, note });
  } catch (err: any) {
    console.error('Reminders meetings GET error:', err.message);
    return NextResponse.json({ error: 'Error al buscar reuniones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recordName = String(body?.recordName || '').trim();
    if (!recordName) return NextResponse.json({ error: 'Falta la reunión' }, { status: 400 });

    const result = await generateReminderFromRecord(user.userId, recordName);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    if (err instanceof MeetingScanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Reminders meetings POST error:', err.message);
    return NextResponse.json({ error: 'Error al generar el recordatorio' }, { status: 500 });
  }
}
