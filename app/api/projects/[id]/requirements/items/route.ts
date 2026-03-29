import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { requirement_id, title } = await req.json();

    if (!requirement_id || !title) return NextResponse.json({ error: 'requirement_id and title required' }, { status: 400 });

    const maxOrder = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM gcc_world.requirement_items WHERE requirement_id = $1`, [requirement_id]
    );

    const { rows } = await pool.query(
      `INSERT INTO gcc_world.requirement_items (requirement_id, title, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [requirement_id, title, maxOrder.rows[0].next]
    );
    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const body = await req.json();

    // Reorder
    if (body.ordered_ids && body.requirement_id) {
      for (let i = 0; i < body.ordered_ids.length; i++) {
        await pool.query(`UPDATE gcc_world.requirement_items SET sort_order = $1 WHERE id = $2`, [i, body.ordered_ids[i]]);
      }
      return NextResponse.json({ message: 'Reordered' });
    }

    // Toggle complete or edit title
    if (body.item_id) {
      if (body.is_completed !== undefined) {
        await pool.query(
          `UPDATE gcc_world.requirement_items SET is_completed = $1, completed_at = $2, updated_at = NOW() WHERE id = $3`,
          [body.is_completed, body.is_completed ? new Date() : null, body.item_id]
        );
      }
      if (body.title !== undefined) {
        await pool.query(`UPDATE gcc_world.requirement_items SET title = $1, updated_at = NOW() WHERE id = $2`, [body.title, body.item_id]);
      }
      const { rows } = await pool.query(`SELECT * FROM gcc_world.requirement_items WHERE id = $1`, [body.item_id]);
      return NextResponse.json({ data: rows[0] });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { item_id } = await req.json();

    await pool.query(`DELETE FROM gcc_world.requirement_items WHERE id = $1`, [item_id]);
    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
