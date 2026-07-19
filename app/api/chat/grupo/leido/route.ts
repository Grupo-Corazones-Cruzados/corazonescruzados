import { NextRequest, NextResponse } from 'next/server';
import { requireChatUser } from '@/lib/chat/access';
import { getGroupConversation, markRead } from '@/lib/chat/chat-db';

export const dynamic = 'force-dynamic';

/** POST `{ lastId }` — marca el chat leído hasta ese mensaje (apaga la burbuja de no leídos). */
export async function POST(req: NextRequest) {
  const u = await requireChatUser();
  if (!u) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const b = await req.json();
    const lastId = Number(b?.lastId);
    if (!Number.isFinite(lastId) || lastId < 0) {
      return NextResponse.json({ error: 'Mensaje no válido.' }, { status: 400 });
    }
    const conv = await getGroupConversation();
    await markRead(conv.id, u.userId, lastId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Chat grupal leído:', err.message);
    return NextResponse.json({ error: 'No se pudo marcar como leído.' }, { status: 500 });
  }
}
