import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    // Ensure columns exist
    await pool.query(`
      ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS ruc VARCHAR(13);
      ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS address TEXT;
    `);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(body)) {
      if (['name', 'email', 'phone', 'ruc', 'address'].includes(key)) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE gcc_world.clients SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values
    );

    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
