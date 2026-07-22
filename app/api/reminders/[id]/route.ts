import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureReminderTables, normalizeTasks } from '@/lib/reminders/schema';

async function canAccess(userId: string, reminderId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.reminders WHERE id = $1 AND (user_id = $2 OR created_by = $2) LIMIT 1`,
    [reminderId, userId],
  );
  return !!rows[0];
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureReminderTables();
    const { id } = await params;
    if (!(await canAccess(user.userId, id))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { rows: [r] } = await pool.query(`SELECT * FROM gcc_world.reminders WHERE id = $1`, [id]);
    const { rows: atts } = await pool.query(
      `SELECT id, filename, content_type, kind, size, created_at FROM gcc_world.reminder_attachments WHERE reminder_id = $1 ORDER BY id`,
      [id],
    );
    return NextResponse.json({ data: { ...r, attachments: atts } });
  } catch (err: any) {
    console.error('Reminder GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureReminderTables();
    const { id } = await params;
    if (!(await canAccess(user.userId, id))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const body = await req.json();
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (body.title !== undefined) { fields.push(`title = $${i++}`); values.push(String(body.title).trim()); }
    if (body.notes !== undefined) { fields.push(`notes = $${i++}`); values.push(String(body.notes || '').trim() || null); }
    if (body.remind_at !== undefined) { fields.push(`remind_at = $${i++}`); values.push(body.remind_at || null); }
    if (body.tasks !== undefined) { fields.push(`tasks = $${i++}`); values.push(JSON.stringify(normalizeTasks(body.tasks))); }
    if (body.status !== undefined && ['active', 'done'].includes(body.status)) { fields.push(`status = $${i++}`); values.push(body.status); }
    if (fields.length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const { rows } = await pool.query(`UPDATE gcc_world.reminders SET ${fields.join(', ')} WHERE id = $${i} RETURNING id`, values);
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Reminder PATCH error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await ensureReminderTables();
    const { id } = await params;
    if (!(await canAccess(user.userId, id))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    await pool.query(`DELETE FROM gcc_world.reminder_attachments WHERE reminder_id = $1`, [id]);
    await pool.query(`DELETE FROM gcc_world.reminders WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Reminder DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
