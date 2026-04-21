import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

async function resolveMemberId(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT member_id FROM gcc_world.users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.member_id || null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { rows } = await pool.query(
      `SELECT calendar_public_token, calendar_public_token_created_at
       FROM gcc_world.members WHERE id = $1`,
      [memberId],
    );
    const token = rows[0]?.calendar_public_token || null;
    return NextResponse.json({
      token,
      created_at: rows[0]?.calendar_public_token_created_at || null,
      member_id: memberId,
    });
  } catch (err: any) {
    console.error('Public-link GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE gcc_world.members
         SET calendar_public_token = $1,
             calendar_public_token_created_at = NOW()
       WHERE id = $2`,
      [token, memberId],
    );

    return NextResponse.json({ token, member_id: memberId });
  } catch (err: any) {
    console.error('Public-link POST error:', err.message);
    return NextResponse.json({ error: 'Error al generar enlace' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    await pool.query(
      `UPDATE gcc_world.members
         SET calendar_public_token = NULL,
             calendar_public_token_created_at = NULL
       WHERE id = $1`,
      [memberId],
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Public-link DELETE error:', err.message);
    return NextResponse.json({ error: 'Error al revocar' }, { status: 500 });
  }
}
