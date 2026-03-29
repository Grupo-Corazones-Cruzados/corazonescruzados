import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });
    const { agentId } = await params;
    const { rows } = await pool.query(
      `SELECT id, agent_id, filename, file_type, file_size, created_at FROM gcc_world.flow_chatbot_knowledge WHERE agent_id = $1 ORDER BY created_at DESC`, [agentId]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) { return NextResponse.json({ data: [] }); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { agentId } = await params;
    const body = await req.json();
    const { filename, content, file_type, file_size } = body;
    if (!filename || !content) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_chatbot_knowledge (agent_id, filename, content, file_type, file_size) VALUES ($1, $2, $3, $4, $5) RETURNING id, agent_id, filename, file_type, file_size, created_at`,
      [agentId, filename, content, file_type || 'text', file_size || 0]
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const knowledgeId = searchParams.get('knowledgeId');
    if (!knowledgeId) return NextResponse.json({ error: 'knowledgeId requerido' }, { status: 400 });
    await pool.query(`DELETE FROM gcc_world.flow_chatbot_knowledge WHERE id = $1`, [knowledgeId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
