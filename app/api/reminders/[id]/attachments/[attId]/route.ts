import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function canAccess(userId: string, reminderId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.reminders WHERE id = $1 AND (user_id = $2 OR created_by = $2) LIMIT 1`,
    [reminderId, userId],
  );
  return !!rows[0];
}

/** Descarga un adjunto (devuelve el archivo con su tipo). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; attId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id, attId } = await params;
    if (!(await canAccess(user.userId, id))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { rows: [att] } = await pool.query(
      `SELECT filename, content_type, data FROM gcc_world.reminder_attachments WHERE id = $1 AND reminder_id = $2`,
      [attId, id],
    );
    if (!att) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const data: string = att.data || '';
    // Los adjuntos se guardan como data URL base64 (`data:<mime>;base64,<b64>`).
    const m = data.match(/^data:([^;]+);base64,([\s\S]*)$/);
    const buf = m ? Buffer.from(m[2], 'base64') : Buffer.from(data, 'utf8');
    const type = att.content_type || (m ? m[1] : 'application/octet-stream');
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': type,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename || 'archivo')}"`,
      },
    });
  } catch (err: any) {
    console.error('Reminder attachment GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; attId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id, attId } = await params;
    if (!(await canAccess(user.userId, id))) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    await pool.query(`DELETE FROM gcc_world.reminder_attachments WHERE id = $1 AND reminder_id = $2`, [attId, id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Reminder attachment DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
