import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

    const res = await pool.query(
      `UPDATE gcc_world.member_calendar_subscribers
         SET verified = TRUE,
             verified_at = NOW(),
             verification_token = NULL
       WHERE verification_token = $1
       RETURNING email, member_id`,
      [token],
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Token inválido o ya utilizado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, email: res.rows[0].email });
  } catch (err: any) {
    console.error('Calendar verify error:', err.message);
    return NextResponse.json({ error: 'Error al verificar' }, { status: 500 });
  }
}
