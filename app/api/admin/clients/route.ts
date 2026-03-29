import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ data: [] }, { status: 403 });

    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, phone, avatar_url, is_verified, created_at
       FROM gcc_world.users
       WHERE role = 'client'
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('Clients error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
