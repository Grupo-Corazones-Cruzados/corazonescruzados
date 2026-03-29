import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.flow_chatbot_agents (
      id SERIAL PRIMARY KEY,
      flow_id INT NOT NULL REFERENCES gcc_world.flows(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      ai_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
      ai_api_key TEXT NOT NULL,
      ai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
      ai_config JSONB DEFAULT '{}',
      wait_seconds INT DEFAULT 8,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.flow_chatbot_knowledge (
      id SERIAL PRIMARY KEY,
      agent_id INT NOT NULL REFERENCES gcc_world.flow_chatbot_agents(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      content TEXT,
      file_type VARCHAR(50),
      file_size INT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.flow_chatbot_qa_lists (
      id SERIAL PRIMARY KEY,
      agent_id INT NOT NULL REFERENCES gcc_world.flow_chatbot_agents(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      selected BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.flow_chatbot_qa_items (
      id SERIAL PRIMARY KEY,
      list_id INT NOT NULL REFERENCES gcc_world.flow_chatbot_qa_lists(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gcc_world.flow_chatbot_conversations (
      id SERIAL PRIMARY KEY,
      agent_id INT NOT NULL REFERENCES gcc_world.flow_chatbot_agents(id) ON DELETE CASCADE,
      contact_phone VARCHAR(30) NOT NULL,
      contact_name VARCHAR(255),
      paused BOOLEAN DEFAULT false,
      last_message_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(agent_id, contact_phone)
    );
    CREATE TABLE IF NOT EXISTS gcc_world.flow_chatbot_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INT NOT NULL REFERENCES gcc_world.flow_chatbot_conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      processed BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });
    await ensureTables();
    const { id } = await params;
    const { rows } = await pool.query(
      `SELECT a.*,
        (SELECT COUNT(*)::int FROM gcc_world.flow_chatbot_knowledge WHERE agent_id = a.id) as knowledge_count,
        (SELECT COUNT(*)::int FROM gcc_world.flow_chatbot_conversations WHERE agent_id = a.id) as conversation_count
       FROM gcc_world.flow_chatbot_agents a WHERE a.flow_id = $1 ORDER BY a.created_at DESC`, [id]
    );
    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Agents GET error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await ensureTables();
    const { id } = await params;
    const body = await req.json();
    const { name, description, ai_provider, ai_api_key, ai_model, ai_config, wait_seconds } = body;
    if (!name?.trim() || !ai_api_key?.trim()) return NextResponse.json({ error: 'Nombre y API key son requeridos' }, { status: 400 });
    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_chatbot_agents (flow_id, name, description, ai_provider, ai_api_key, ai_model, ai_config, wait_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, name.trim(), description || '', ai_provider || 'openai', ai_api_key.trim(), ai_model || 'gpt-4o-mini', JSON.stringify(ai_config || {}), wait_seconds || 8]
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    console.error('Agents POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
