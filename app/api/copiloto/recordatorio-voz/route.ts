import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { espacioHabilitado, tokenServicio } from '@/lib/espacio-trabajo/guardia';
import { ensureReminderTables, normalizeTasks } from '@/lib/reminders/schema';
import { createNotification } from '@/lib/notifications';

/**
 * Los recordatorios de «GUMDRAMON, RECORDATORIO». Por ahora todos van a la cuenta de Fernando (2026-11-06: «por
 * ahora todo va a mi cuenta»). Cuando la herramienta pase a otros usuarios, este dato pasará a ser el de quien la use.
 */
const CUENTA = 'lfgonzalezm0@grupocc.org';
const ID = /^[0-9a-f-]{36}$/i;

const igual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Solo en la instancia local, con el token del Espacio: en Railway da 404. */
export async function POST(req: Request) {
  if (!espacioHabilitado()) return new NextResponse('Not Found', { status: 404 });
  if (!igual(req.headers.get('authorization') || '', `Bearer ${tokenServicio()}`)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    const { id, titulo, notas, fecha, tareas, dictado } = await req.json();
    const title = String(titulo || '').trim().slice(0, 200);
    const cuando = new Date(fecha);
    if (!ID.test(String(id)) || !title || Number.isNaN(cuando.getTime())) return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });

    await ensureReminderTables();
    const { rows: [dueno] } = await pool.query(`SELECT id FROM gcc_world.users WHERE lower(email) = $1`, [CUENTA]);
    if (!dueno) return NextResponse.json({ error: `No existe la cuenta ${CUENTA}.` }, { status: 409 });

    // Reintentar una entrega que sí llegó no crea otro recordatorio.
    const origen = `gumdramon:${id}`;
    const { rows: [ya] } = await pool.query(`SELECT id FROM gcc_world.reminders WHERE source = 'voz' AND source_event_id = $1`, [origen]);
    if (ya) return NextResponse.json({ reminderId: Number(ya.id) });

    const { rows: [r] } = await pool.query(
      `INSERT INTO gcc_world.reminders (user_id, title, notes, remind_at, tasks, status, source, source_event_id, created_by)
       VALUES ($1, $2, $3, $4, $5, 'active', 'voz', $6, $1) RETURNING id`,
      [dueno.id, title, String(notas || '').trim() || null, cuando.toISOString(), JSON.stringify(normalizeTasks(tareas)), origen],
    );
    // Lo dicho tal cual se conserva: la redacción es una interpretación y podría haber entendido mal.
    const original = String(dictado || '').trim();
    if (original) {
      await pool.query(
        `INSERT INTO gcc_world.reminder_attachments (reminder_id, filename, content_type, kind, data, size)
         VALUES ($1, 'dictado.txt', 'text/plain', 'file', $2, $3)`,
        [r.id, `data:text/plain;base64,${Buffer.from(original, 'utf8').toString('base64')}`, Buffer.byteLength(original, 'utf8')],
      );
    }
    try {
      await createNotification(String(dueno.id), {
        type: 'reminder', title: `Recordatorio: ${title}`, message: 'Guardado por Gumdramon', link: `/dashboard/recordatorios?open=${r.id}`,
      }, { push: false });
    } catch { /* la notificación no debe bloquear */ }

    return NextResponse.json({ reminderId: Number(r.id) });
  } catch (e: any) {
    console.error('recordatorio por voz:', e.message);
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
