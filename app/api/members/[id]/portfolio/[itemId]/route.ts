import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { uploadImages, uploadImage, isBase64Image } from '@/lib/cloudinary';
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

    const folder = `corazones-cruzados/portfolio/${id}`;

    const allowed = ['title', 'description', 'project_url', 'tags', 'item_type'];
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    // image_url puede venir en base64 → súbelo a Cloudinary.
    if ('image_url' in body) {
      const url = body.image_url && isBase64Image(body.image_url)
        ? await uploadImage(body.image_url, folder)
        : body.image_url;
      fields.push(`image_url = $${idx++}`);
      values.push(url);
    }

    // Handle price -> cost mapping
    if ('price' in body) {
      fields.push(`cost = $${idx++}`);
      values.push(Number(body.price) || 0);
    }

    // Handle images array (base64 → Cloudinary)
    if ('images' in body) {
      const raw = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
      const images = await uploadImages(raw, folder);
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
