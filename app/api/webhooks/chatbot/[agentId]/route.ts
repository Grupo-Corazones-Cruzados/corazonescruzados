import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

// Pending timers: agentId_phone -> timeout handle
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const body = await req.json();

    // YCloud webhook format
    const event = body.type || '';
    const msg = body.whatsappInboundMessage || body.message || body;
    const from = msg.from || msg.customerProfile?.waid || '';
    const msgBody = msg.text?.body || msg.body || msg.content || '';
    const contactName = msg.customerProfile?.name || msg.profile?.name || from;

    if (!from || !msgBody) return NextResponse.json({ ok: true });

    // Get agent
    const { rows: [agent] } = await pool.query(
      `SELECT * FROM gcc_world.flow_chatbot_agents WHERE id = $1`, [agentId]
    );
    if (!agent || agent.status !== 'active') return NextResponse.json({ ok: true });

    // Get flow config (YCloud API key)
    const { rows: [flow] } = await pool.query(`SELECT config FROM gcc_world.flows WHERE id = $1`, [agent.flow_id]);
    const yCloudApiKey = flow?.config?.ycloud_api_key;
    if (!yCloudApiKey) return NextResponse.json({ ok: true });

    // Get or create conversation
    let { rows: [conv] } = await pool.query(
      `SELECT * FROM gcc_world.flow_chatbot_conversations WHERE agent_id = $1 AND contact_phone = $2`, [agentId, from]
    );
    if (!conv) {
      const { rows } = await pool.query(
        `INSERT INTO gcc_world.flow_chatbot_conversations (agent_id, contact_phone, contact_name, last_message_at)
         VALUES ($1, $2, $3, NOW()) RETURNING *`, [agentId, from, contactName]
      );
      conv = rows[0];
    } else {
      await pool.query(`UPDATE gcc_world.flow_chatbot_conversations SET last_message_at = NOW(), contact_name = COALESCE($1, contact_name) WHERE id = $2`, [contactName, conv.id]);
    }

    // Check if paused
    if (conv.paused) return NextResponse.json({ ok: true });

    // Store user message
    await pool.query(
      `INSERT INTO gcc_world.flow_chatbot_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conv.id, msgBody]
    );

    // Wait timer logic: cancel previous timer, start new one
    const timerKey = `${agentId}_${from}`;
    const existing = pendingTimers.get(timerKey);
    if (existing) clearTimeout(existing);

    const waitMs = (agent.wait_seconds || 8) * 1000;
    const timer = setTimeout(() => {
      pendingTimers.delete(timerKey);
      processAndRespond(agent, conv.id, from, yCloudApiKey).catch(err => console.error('Chatbot process error:', err));
    }, waitMs);
    pendingTimers.set(timerKey, timer);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    return NextResponse.json({ ok: true });
  }
}

async function processAndRespond(agent: any, conversationId: number, phone: string, yCloudApiKey: string) {
  try {
    // Check if still active and not paused
    const { rows: [conv] } = await pool.query(`SELECT * FROM gcc_world.flow_chatbot_conversations WHERE id = $1`, [conversationId]);
    if (!conv || conv.paused) return;

    // Get unprocessed user messages
    const { rows: newMsgs } = await pool.query(
      `SELECT content FROM gcc_world.flow_chatbot_messages WHERE conversation_id = $1 AND role = 'user' AND processed = false ORDER BY created_at`, [conversationId]
    );
    if (newMsgs.length === 0) return;

    // Mark as processed
    await pool.query(
      `UPDATE gcc_world.flow_chatbot_messages SET processed = true WHERE conversation_id = $1 AND role = 'user' AND processed = false`, [conversationId]
    );

    // Get recent conversation history (last 20 messages for context)
    const { rows: history } = await pool.query(
      `SELECT role, content FROM gcc_world.flow_chatbot_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 20`, [conversationId]
    );
    history.reverse();

    // Get knowledge
    const { rows: knowledge } = await pool.query(
      `SELECT content FROM gcc_world.flow_chatbot_knowledge WHERE agent_id = $1`, [agent.id]
    );

    // Get selected Q&A list
    const { rows: qaLists } = await pool.query(
      `SELECT id FROM gcc_world.flow_chatbot_qa_lists WHERE agent_id = $1 AND selected = true`, [agent.id]
    );
    let qaItems: any[] = [];
    if (qaLists.length > 0) {
      const { rows } = await pool.query(
        `SELECT question, answer FROM gcc_world.flow_chatbot_qa_items WHERE list_id = $1`, [qaLists[0].id]
      );
      qaItems = rows;
    }

    // Build system prompt
    const knowledgeText = knowledge.map((k: any) => k.content).filter(Boolean).join('\n\n---\n\n');
    const qaText = qaItems.map((qa: any) => `P: ${qa.question}\nR: ${qa.answer}`).join('\n\n');
    const purpose = agent.description || 'Asistente de atención al cliente';

    const systemPrompt = `Eres un asistente de chatbot para un negocio. Tu propósito es: ${purpose}

REGLAS IMPORTANTES:
- SOLO responde preguntas relacionadas con el negocio y su propósito descrito arriba.
- Si el cliente pregunta sobre temas NO relacionados al rubro del negocio, responde amablemente que solo puedes ayudar con temas del negocio.
- Sé conciso, amable y profesional.
- Responde en el mismo idioma que el cliente.
- No inventes información. Si no sabes la respuesta, dilo honestamente.

${knowledgeText ? `CONOCIMIENTO DEL NEGOCIO:\n${knowledgeText}\n` : ''}
${qaText ? `PREGUNTAS FRECUENTES:\n${qaText}\n` : ''}`;

    // Build messages for AI
    const userCombined = newMsgs.map((m: any) => m.content).join('\n');

    // Call AI provider
    let aiResponse = '';
    if (agent.ai_provider === 'openai') {
      aiResponse = await callOpenAI(agent.ai_api_key, agent.ai_model || 'gpt-4o-mini', systemPrompt, history, userCombined);
    } else if (agent.ai_provider === 'anthropic') {
      aiResponse = await callAnthropic(agent.ai_api_key, agent.ai_model || 'claude-sonnet-4-20250514', systemPrompt, history, userCombined);
    } else {
      // Default to OpenAI-compatible
      aiResponse = await callOpenAI(agent.ai_api_key, agent.ai_model || 'gpt-4o-mini', systemPrompt, history, userCombined);
    }

    if (!aiResponse) return;

    // Store assistant message
    await pool.query(
      `INSERT INTO gcc_world.flow_chatbot_messages (conversation_id, role, content, processed) VALUES ($1, 'assistant', $2, true)`,
      [conversationId, aiResponse]
    );

    // Send via YCloud
    await sendYCloudMessage(yCloudApiKey, phone, aiResponse);
  } catch (err: any) {
    console.error('Process respond error:', err.message);
  }
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, history: any[], userMessage: string): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(0, -1).map((m: any) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: 500, temperature: 0.7 }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey: string, model: string, systemPrompt: string, history: any[], userMessage: string): Promise<string> {
  const messages = [
    ...history.slice(0, -1).map((m: any) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system: systemPrompt, messages, max_tokens: 500 }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function sendYCloudMessage(apiKey: string, to: string, text: string) {
  await fetch('https://api.ycloud.com/v2/whatsapp/messages', {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, type: 'text', text: { body: text } }),
  });
}
