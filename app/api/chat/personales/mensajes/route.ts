import { NextRequest, NextResponse } from 'next/server';
import { guardScope } from '@/lib/chat/scope-guard';
import { listMessages, postMessage, getUnreadCount } from '@/lib/chat/chat-db';

export const dynamic = 'force-dynamic';
const MAX_LEN = 4000;

/** GET — mensajes del chat de un origen. `?kind=&ref=` + `after`/`before` como el grupal. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const g = await guardScope(sp.get('kind'), sp.get('ref'));
  if (!g.ok) return NextResponse.json({ error: 'No autorizado' }, { status: g.status });
  try {
    const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    const [messages, unread] = await Promise.all([
      listMessages(g.conversationId, { after: num(sp.get('after')), before: num(sp.get('before')), limit: num(sp.get('limit')) ?? 50 }),
      getUnreadCount(g.conversationId, g.userId),
    ]);
    return NextResponse.json({ data: { conversationId: g.conversationId, me: g.userId, messages, unread } });
  } catch (err: any) {
    console.error('Chat personal GET:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el chat.' }, { status: 500 });
  }
}

/** POST `{ kind, ref, body }` — envía un mensaje al chat de ese origen. */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const g = await guardScope(b?.kind ?? null, b?.ref != null ? String(b.ref) : null);
    if (!g.ok) return NextResponse.json({ error: 'No autorizado' }, { status: g.status });

    const body = String(b?.body ?? '').trim();
    if (!body) return NextResponse.json({ error: 'El mensaje está vacío.' }, { status: 400 });
    if (body.length > MAX_LEN) return NextResponse.json({ error: `Máximo ${MAX_LEN} caracteres.` }, { status: 400 });

    const message = await postMessage(g.conversationId, g.userId, body);
    return NextResponse.json({ data: message });
  } catch (err: any) {
    console.error('Chat personal POST:', err.message);
    return NextResponse.json({ error: 'No se pudo enviar el mensaje.' }, { status: 500 });
  }
}
