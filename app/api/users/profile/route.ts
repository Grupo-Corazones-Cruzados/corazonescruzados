import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { first_name, last_name, phone, avatar_url } = await req.json();

    await pool.query(
      `UPDATE gcc_world.users SET first_name = $1, last_name = $2, phone = $3, avatar_url = $4, updated_at = NOW() WHERE id = $5`,
      [first_name || null, last_name || null, phone || null, avatar_url || null, user.userId]
    );

    return NextResponse.json({ message: 'Perfil actualizado' });
  } catch (err: any) {
    console.error('Profile update error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}
