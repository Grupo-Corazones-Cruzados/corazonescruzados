import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { isAvailabilityStatus } from '@/lib/calendar/availability';
import { setMemberAvailability } from '@/lib/calendar/availability-db';

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
      `SELECT availability_status, availability_updated_at
         FROM gcc_world.members WHERE id = $1`,
      [memberId],
    );
    return NextResponse.json({
      status: rows[0]?.availability_status || 'conectado',
      updated_at: rows[0]?.availability_updated_at || null,
    });
  } catch (err: any) {
    console.error('Availability GET error:', err.message);
    return NextResponse.json({ error: 'Error al cargar disponibilidad' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const memberId = await resolveMemberId(user.userId);
    if (!memberId) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const status = body?.status;
    if (!isAvailabilityStatus(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }
    await client.query('BEGIN');
    const createdEvent = await setMemberAvailability(client, memberId, user.userId, status);
    await client.query('COMMIT');
    return NextResponse.json({ status, event: createdEvent });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Availability POST error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar disponibilidad' }, { status: 500 });
  } finally {
    client.release();
  }
}
