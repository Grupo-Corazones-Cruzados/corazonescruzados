import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await params;
    const { name, description, is_active } = await req.json();

    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); values.push(is_active); }
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE gcc_world.centralized_systems SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { id } = await params;

    // Delete access entries referencing this system
    await pool.query(`DELETE FROM gcc_world.centralized_member_access WHERE system_id = $1`, [id]);
    const { rowCount } = await pool.query(`DELETE FROM gcc_world.centralized_systems WHERE id = $1`, [id]);

    if (rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
