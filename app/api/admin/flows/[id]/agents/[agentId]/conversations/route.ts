import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });
    const { agentId } = await params;
    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*)::int FROM gcc_world.flow_chatbot_messages WHERE conversation_id = c.id) as message_count
       FROM gcc_world.flow_chatbot_conversations c
       WHERE c.agent_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST`, [agentId]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) { return NextResponse.json({ data: [] }); }
}
