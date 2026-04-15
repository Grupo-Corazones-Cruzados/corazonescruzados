import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await pool.query(`
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS youtube_handle TEXT;
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS tiktok_handle TEXT;
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS facebook_handle TEXT;
    `);

    const body = await req.json();
    const { first_name, last_name, phone, avatar_url } = body;
    const youtube = normalizeHandle(body.youtube_handle);
    const tiktok = normalizeHandle(body.tiktok_handle);
    const instagram = normalizeHandle(body.instagram_handle);
    const facebook = normalizeHandle(body.facebook_handle);

    await pool.query(
      `UPDATE gcc_world.users
       SET first_name = $1, last_name = $2, phone = $3, avatar_url = $4,
           youtube_handle = $5, tiktok_handle = $6, instagram_handle = $7, facebook_handle = $8,
           updated_at = NOW()
       WHERE id = $9`,
      [first_name || null, last_name || null, phone || null, avatar_url || null,
       youtube, tiktok, instagram, facebook, user.userId]
    );

    return NextResponse.json({ message: 'Perfil actualizado' });
  } catch (err: any) {
    console.error('Profile update error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}
