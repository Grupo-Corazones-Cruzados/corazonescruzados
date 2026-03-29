import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { rows } = await pool.query(
      `SELECT id, name, "agentId" FROM gcc_world."Project" ORDER BY name`
    );

    return NextResponse.json({ data: rows });
  } catch (err: any) {
    console.error('DigiMundo projects error:', err.message);
    return NextResponse.json({ data: [] });
  }
}
