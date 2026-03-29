import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; agentId: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });
    const { listId } = await params;
    const { rows: list } = await pool.query(`SELECT * FROM gcc_world.flow_chatbot_qa_lists WHERE id = $1`, [listId]);
    const { rows: items } = await pool.query(`SELECT * FROM gcc_world.flow_chatbot_qa_items WHERE list_id = $1 ORDER BY created_at`, [listId]);
    return NextResponse.json({ list: list[0] || null, items });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

// Add Q&A item
export async function POST(req: Request, { params }: { params: Promise<{ id: string; agentId: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { listId } = await params;
    const body = await req.json();

    // Support single or batch
    const items: { question: string; answer: string }[] = Array.isArray(body) ? body : [body];
    if (items.some(i => !i.question?.trim() || !i.answer?.trim())) {
      return NextResponse.json({ error: 'Pregunta y respuesta requeridas' }, { status: 400 });
    }

    const values: any[] = [];
    const placeholders: string[] = [];
    items.forEach((item, i) => {
      const offset = i * 3;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
      values.push(listId, item.question.trim(), item.answer.trim());
    });

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.flow_chatbot_qa_items (list_id, question, answer) VALUES ${placeholders.join(', ')} RETURNING *`, values
    );
    return NextResponse.json({ data: rows }, { status: 201 });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

// Toggle selection or delete list
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; agentId: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { agentId, listId } = await params;
    const { selected } = await req.json();
    if (selected) {
      // Deselect all others first, then select this one
      await pool.query(`UPDATE gcc_world.flow_chatbot_qa_lists SET selected = false WHERE agent_id = $1`, [agentId]);
    }
    const { rows } = await pool.query(
      `UPDATE gcc_world.flow_chatbot_qa_lists SET selected = $1 WHERE id = $2 RETURNING *`, [!!selected, listId]
    );
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; agentId: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    const { listId } = await params;
    if (itemId) {
      await pool.query(`DELETE FROM gcc_world.flow_chatbot_qa_items WHERE id = $1`, [itemId]);
    } else {
      await pool.query(`DELETE FROM gcc_world.flow_chatbot_qa_lists WHERE id = $1`, [listId]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
