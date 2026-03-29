import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; listId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { listId } = await params;
    await pool.query(`DELETE FROM gcc_world.flow_contact_lists WHERE id = $1`, [listId]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Contact list DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
