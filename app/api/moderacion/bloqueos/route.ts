import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { bloquear, bloqueosDe } from '@/lib/moderacion';

export const dynamic = 'force-dynamic';

/** GET — a quién bloqueó esta cuenta. Sin sesión, nada (el Marketplace público no filtra). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ data: { lista: [], userIds: [], memberIds: [] } });
  try {
    return NextResponse.json({ data: await bloqueosDe(user.userId) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudieron cargar los bloqueos' }, { status: 500 });
  }
}

/** POST { userId } | { memberId } — bloquear a una persona. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para bloquear' }, { status: 401 });
  try {
    const b = await req.json();
    const memberId = b.memberId != null && /^\d+$/.test(String(b.memberId)) ? Number(b.memberId) : undefined;
    const userId = typeof b.userId === 'string' && /^[0-9a-f-]{36}$/i.test(b.userId) ? b.userId : undefined;
    const r = await bloquear(user.userId, { userId, memberId });
    return NextResponse.json({ ok: true, nombre: r.nombre });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'No se pudo bloquear' }, { status: 400 });
  }
}
