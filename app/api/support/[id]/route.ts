import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { rows } = await pool.query(
      `SELECT st.*, u.first_name, u.last_name, u.email as user_email
       FROM gcc_world.support_tickets st
       LEFT JOIN gcc_world.users u ON u.id = st.user_id
       WHERE st.id = $1`,
      [id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const ticket = rows[0];
    if (ticket.user_id !== user.userId && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get replies
    const replies = await pool.query(
      `SELECT sr.*, u.first_name, u.last_name, u.avatar_url
       FROM gcc_world.support_replies sr
       LEFT JOIN gcc_world.users u ON u.id = sr.user_id
       WHERE sr.ticket_id = $1
       ORDER BY sr.created_at`,
      [id]
    );

    return NextResponse.json({ data: { ...ticket, replies: replies.rows } });
  } catch (err: any) {
    console.error('Support GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { status, message, attachment_url } = await req.json();

    // Handle reply
    if (message) {
      const { rows } = await pool.query(
        `INSERT INTO gcc_world.support_replies (ticket_id, user_id, message, attachment_url)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, user.userId, message, attachment_url || null]
      );
      return NextResponse.json({ data: rows[0] }, { status: 201 });
    }

    // Handle status change
    if (status) {
      const valid = ['open', 'in_progress', 'resolved', 'closed'];
      if (!valid.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

      const { rows } = await pool.query(
        `UPDATE gcc_world.support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, id]
      );
      if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ data: rows[0] });
    }

    return NextResponse.json({ error: 'No action' }, { status: 400 });
  } catch (err: any) {
    console.error('Support PATCH error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
