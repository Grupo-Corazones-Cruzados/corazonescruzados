import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureReminderTables, normalizeTasks } from '@/lib/reminders/schema';
import { createNotification } from '@/lib/notifications';

const MAX_ATTACH_CHARS = 12 * 1024 * 1024; // ~9MB de archivo en base64

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureReminderTables();
    const { rows } = await pool.query(
      `SELECT r.id, r.title, r.notes, r.remind_at, r.tasks, r.status, r.source, r.source_event_id,
              r.created_at,
              (SELECT COUNT(*) FROM gcc_world.reminder_attachments a WHERE a.reminder_id = r.id) AS attachment_count
         FROM gcc_world.reminders r
        WHERE r.user_id = $1 OR r.created_by = $1
        ORDER BY (r.status = 'done'), r.remind_at NULLS LAST, r.created_at DESC`,
      [user.userId],
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Reminders GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureReminderTables();

    const body = await req.json();
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    const tasks = normalizeTasks(body.tasks);

    const { rows: [r] } = await pool.query(
      `INSERT INTO gcc_world.reminders (user_id, title, notes, remind_at, tasks, source, created_by)
       VALUES ($1, $2, $3, $4, $5, 'manual', $1) RETURNING id`,
      [user.userId, title, String(body.notes || '').trim() || null, body.remind_at || null, JSON.stringify(tasks)],
    );

    // Adjuntos enviados con el recordatorio (data URL base64).
    for (const a of (Array.isArray(body.attachments) ? body.attachments : [])) {
      const data = typeof a?.data === 'string' ? a.data : '';
      if (!data || data.length > MAX_ATTACH_CHARS) continue;
      await pool.query(
        `INSERT INTO gcc_world.reminder_attachments (reminder_id, filename, content_type, kind, data, size)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [r.id, String(a.filename || 'archivo'), a.content_type || null, a.kind === 'transcript' ? 'transcript' : 'file', data, Number(a.size) || null],
      );
    }

    try {
      await createNotification(user.userId, {
        type: 'reminder',
        title: `Recordatorio: ${title}`,
        message: body.remind_at ? `Programado para ${new Date(body.remind_at).toLocaleString('es-EC')}` : 'Sin fecha',
        link: '/dashboard/recordatorios',
      });
    } catch { /* la notificación no debe bloquear */ }

    return NextResponse.json({ data: { id: r.id } }, { status: 201 });
  } catch (err: any) {
    console.error('Reminders POST error:', err.message);
    return NextResponse.json({ error: 'Error al crear el recordatorio' }, { status: 500 });
  }
}
