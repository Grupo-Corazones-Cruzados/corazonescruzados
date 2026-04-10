import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, actionId } = await params;

    const { rows: tRows } = await pool.query(
      `SELECT member_id FROM gcc_world.tickets WHERE id = $1`,
      [id]
    );
    const ticket = tRows[0];
    if (!ticket) return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });

    const isAdmin = user.role === 'admin';
    let isAssignedMember = false;
    if (user.role === 'member') {
      const { rows: mRows } = await pool.query(
        `SELECT member_id FROM gcc_world.users WHERE id = $1 LIMIT 1`,
        [user.userId]
      );
      const memberId = mRows[0]?.member_id ? Number(mRows[0].member_id) : null;
      isAssignedMember = !!memberId && Number(ticket.member_id) === memberId;
    }
    if (!isAdmin && !isAssignedMember) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await pool.query(
      `DELETE FROM gcc_world.ticket_actions WHERE id = $1 AND ticket_id = $2`,
      [actionId, id]
    );
    await pool.query(`UPDATE gcc_world.tickets SET updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ message: 'Eliminado' });
  } catch (err: any) {
    console.error('Ticket action DELETE error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
