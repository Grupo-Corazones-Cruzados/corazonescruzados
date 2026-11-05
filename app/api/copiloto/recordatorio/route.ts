import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { espacioHabilitado, tokenServicio } from '@/lib/espacio-trabajo/guardia';
import { ensureReminderTables } from '@/lib/reminders/schema';
import { createMeetingReminder, PREFIJO_COPILOTO } from '@/lib/reminders/meeting-gen';

const igual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * EL COPILOTO DE REUNIONES ENTREGA LA TRANSCRIPCIÓN AL TERMINAR. Solo existe en la instancia local de
 * la Mac (en Railway da 404) y la llama el servicio del Copiloto con el token del Espacio de trabajo.
 * El recordatorio sale por `createMeetingReminder`, igual que los de Meet.
 */
export async function POST(req: Request) {
  if (!espacioHabilitado()) return new NextResponse('Not Found', { status: 404 });
  if (!igual(req.headers.get('authorization') || '', `Bearer ${tokenServicio()}`)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    const { id, transcripcion, fin } = await req.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(id)) || !String(transcripcion || '').trim()) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
    }
    await ensureReminderTables();
    const { rows: [dueno] } = await pool.query(
      `SELECT id FROM gcc_world.users WHERE lower(email) = lower($1) AND role = 'admin'`, [process.env['ESPACIO_ADMIN_EMAIL'] || ''],
    );
    if (!dueno) return NextResponse.json({ error: 'No se encontró al administrador.' }, { status: 409 });

    // Reintentar una entrega que sí llegó no crea otro recordatorio.
    const sourceEventId = `${PREFIJO_COPILOTO}${id}`;
    const { rows: [ya] } = await pool.query(
      `SELECT id, title FROM gcc_world.reminders WHERE source_event_id = $1 AND source = 'meeting'`, [sourceEventId],
    );
    if (ya) return NextResponse.json({ reminderId: Number(ya.id), title: ya.title });

    const r = await createMeetingReminder({
      ownerUserId: String(dueno.id),
      transcript: String(transcripcion),
      meetingTitle: 'Reunión con el Copiloto',
      meetingEndISO: new Date(fin || Date.now()).toISOString(),
      sourceEventId,
      attachmentName: 'transcripcion-copiloto.txt',
      notifyMessage: 'Generado por el Copiloto de reuniones',
    });
    return NextResponse.json(r);
  } catch (e: any) {
    console.error('copiloto recordatorio:', e.message);
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
