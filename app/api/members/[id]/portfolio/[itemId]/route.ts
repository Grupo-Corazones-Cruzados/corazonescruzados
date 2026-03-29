import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, itemId } = await params;
    const body = await req.json();

    // Verify item belongs to this member
    const check = await pool.query(
      `SELECT id FROM gcc_world.member_portfolio_items WHERE id = $1 AND member_id = $2`,
      [itemId, id]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Item no encontrado' }, { status: 404 });
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const allowed = ['title', 'description', 'image_url', 'project_url', 'tags', 'item_type'];
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    // Handle price -> cost mapping
    if ('price' in body) {
      fields.push(`cost = $${idx++}`);
      values.push(Number(body.price) || 0);
    }

    // Handle images array
    if ('images' in body) {
      const images = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
      fields.push(`images = $${idx++}`);
      values.push(images);
      // Also update image_url to first image if present
      if (!('image_url' in body)) {
        fields.push(`image_url = $${idx++}`);
        values.push(images[0] || null);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(itemId);

    const { rows } = await pool.query(
      `UPDATE gcc_world.member_portfolio_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *, cost as price, item_type as type`,
      values
    );

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Portfolio PUT error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id, itemId } = await params;

    await pool.query(
      `DELETE FROM gcc_world.member_portfolio_items WHERE id = $1 AND member_id = $2`,
      [itemId, id]
    );

    return NextResponse.json({ message: 'Deleted' });
  } catch (err: any) {
    console.error('Portfolio DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
