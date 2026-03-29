import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { agentId } = await params;
    const { rows } = await pool.query(`SELECT * FROM gcc_world.flow_chatbot_agents WHERE id = $1`, [agentId]);
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { agentId } = await params;
    const body = await req.json();
    const { name, description, ai_provider, ai_api_key, ai_model, ai_config, wait_seconds, status } = body;
    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_chatbot_agents SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        ai_provider = COALESCE($3, ai_provider), ai_api_key = COALESCE($4, ai_api_key),
        ai_model = COALESCE($5, ai_model), ai_config = COALESCE($6, ai_config),
        wait_seconds = COALESCE($7, wait_seconds), status = COALESCE($8, status), updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name, description, ai_provider, ai_api_key, ai_model, ai_config ? JSON.stringify(ai_config) : null, wait_seconds, status, agentId]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; agentId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { agentId } = await params;
    await pool.query(`DELETE FROM gcc_world.flow_chatbot_agents WHERE id = $1`, [agentId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
