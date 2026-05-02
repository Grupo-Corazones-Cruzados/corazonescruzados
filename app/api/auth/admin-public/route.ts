import { pool } from '@/lib/db';
import { NextResponse } from 'next/server';

// Public read-only info about the global admin — used by the landing
// modal to show the admin's avatar + handle. Returns `null` fields when
// no admin is found instead of failing, so the UI can degrade gracefully.
export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT u.email, u.first_name, u.last_name, u.avatar_url, m.photo_url
       FROM gcc_world.users u
       LEFT JOIN gcc_world.members m ON m.id = u.member_id
       WHERE u.role = 'admin'
       ORDER BY u.created_at ASC
       LIMIT 1`
    );
    const admin = rows[0];
    if (!admin) {
      return NextResponse.json({ name: null, photoUrl: null });
    }
    const photoUrl: string | null = admin.avatar_url || admin.photo_url || null;
    return NextResponse.json({
      name: 'lfgonzalezm0',
      photoUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('GET /api/auth/admin-public error:', message);
    return NextResponse.json({ name: null, photoUrl: null }, { status: 500 });
  }
}
