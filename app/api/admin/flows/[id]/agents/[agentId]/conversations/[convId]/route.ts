import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

// Get conversation messages
export async function GET(req: Request, { params }: { params: Promise<{ id: string; agentId: string; convId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { convId } = await params;
    const { rows: conv } = await pool.query(`SELECT * FROM gcc_world.flow_chatbot_conversations WHERE id = $1`, [convId]);
    const { rows: messages } = await pool.query(
      `SELECT * FROM gcc_world.flow_chatbot_messages WHERE conversation_id = $1 ORDER BY created_at`, [convId]
    );
    return NextResponse.json({ conversation: conv[0] || null, messages });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

// Toggle pause
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; agentId: string; convId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { convId } = await params;
    const { paused } = await req.json();
    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_chatbot_conversations SET paused = $1 WHERE id = $2 RETURNING *`, [!!paused, convId]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
