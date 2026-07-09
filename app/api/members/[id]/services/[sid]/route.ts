import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

async function canManage(user: any, memberId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const { rows } = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [user.userId]);
  return String(rows[0]?.member_id || '') === String(memberId);
}

// PATCH — edita o activa/desactiva un servicio propio { name?, description?, base_price?, is_active? }.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id, sid } = await params;
    if (!(await canManage(user, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const b = await req.json();
    const sets: string[] = [];
    const vals: any[] = [];
    const push = (col: string, val: any) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    if (typeof b.name === 'string') push('name', b.name.trim());
    if (typeof b.description === 'string') push('description', b.description.trim() || null);
    if (b.base_price !== undefined) push('base_price', b.base_price != null && b.base_price !== '' ? Number(b.base_price) : null);
    if (typeof b.is_active === 'boolean') push('is_active', b.is_active);
    if (typeof b.talent === 'string') push('talent', b.talent || null);
    if (sets.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    sets.push('updated_at = NOW()');
    vals.push(sid, id);
    const { rows } = await pool.query(
      `UPDATE gcc_world.services SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND member_id = $${vals.length}
       RETURNING id, name, description, base_price, is_active, talent`,
      vals,
    );
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (err: any) {
    console.error('Member service PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — elimina un servicio propio.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id, sid } = await params;
    if (!(await canManage(user, id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    await pool.query(`DELETE FROM gcc_world.services WHERE id = $1 AND member_id = $2`, [sid, id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Member service DELETE error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
