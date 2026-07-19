import { NextRequest, NextResponse } from 'next/server';
import { guardScope } from '@/lib/chat/scope-guard';
import { markRead } from '@/lib/chat/chat-db';

export const dynamic = 'force-dynamic';

/** POST `{ kind, ref, lastId }` — marca leído hasta ese mensaje. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const g = await guardScope(b?.kind ?? null, b?.ref != null ? String(b.ref) : null);
    if (!g.ok) return NextResponse.json({ error: 'No autorizado' }, { status: g.status });
    const lastId = Number(b?.lastId);
    if (!Number.isFinite(lastId) || lastId < 0) return NextResponse.json({ error: 'Mensaje no válido.' }, { status: 400 });
    await markRead(g.conversationId, g.userId, lastId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'No se pudo marcar como leído.' }, { status: 500 });
  }
}
