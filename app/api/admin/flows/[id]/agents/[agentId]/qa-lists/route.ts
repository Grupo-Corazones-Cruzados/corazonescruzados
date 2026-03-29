import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });
    const { agentId } = await params;
    const { rows } = await pool.query(
      `SELECT ql.*, (SELECT COUNT(*)::int FROM gcc_world.flow_chatbot_qa_items WHERE list_id = ql.id) as item_count
       FROM gcc_world.flow_chatbot_qa_lists ql WHERE ql.agent_id = $1 ORDER BY ql.created_at DESC`, [agentId]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) { return NextResponse.json({ data: [] }); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { agentId } = await params;
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_chatbot_qa_lists (agent_id, name) VALUES ($1, $2) RETURNING *`, [agentId, name.trim()]
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
