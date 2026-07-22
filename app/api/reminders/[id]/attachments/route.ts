import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureReminderTables } from '@/lib/reminders/schema';

const MAX_ATTACH_CHARS = 12 * 1024 * 1024;

async function canAccess(userId: string, reminderId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.reminders WHERE id = $1 AND (user_id = $2 OR created_by = $2) LIMIT 1`,
    [reminderId, userId],
  );
  return !!rows[0];
}

/** Agrega un adjunto (data URL base64) a un recordatorio existente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureReminderTables();
    const { id } = await params;
    if (!(await canAccess(user.userId, id))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const a = await req.json();
    const data = typeof a?.data === 'string' ? a.data : '';
    if (!data) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    if (data.length > MAX_ATTACH_CHARS) return NextResponse.json({ error: 'El archivo es demasiado grande (máx ~9MB)' }, { status: 400 });

    const { rows: [att] } = await pool.query(
      `INSERT INTO gcc_world.reminder_attachments (reminder_id, filename, content_type, kind, data, size)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, filename, content_type, kind, size`,
      [id, String(a.filename || 'archivo'), a.content_type || null, a.kind === 'transcript' ? 'transcript' : 'file', data, Number(a.size) || null],
    );
    await pool.query(`UPDATE gcc_world.reminders SET updated_at = NOW() WHERE id = $1`, [id]);
    return NextResponse.json({ data: att }, { status: 201 });
  } catch (err: any) {
    console.error('Reminder attachment POST error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
