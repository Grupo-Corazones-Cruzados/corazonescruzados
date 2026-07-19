import { NextRequest, NextResponse } from 'next/server';
import { requireChatUser } from '@/lib/chat/access';
import { getGroupConversation, listMessages, postMessage, getUnreadCount, touchPresence } from '@/lib/chat/chat-db';

export const dynamic = 'force-dynamic';

/** Un mensaje largo sigue siendo un mensaje de chat, no un documento. */
const MAX_LEN = 4000;

/**
 * GET — chat grupal.
 *   `?after=<id>` → solo lo nuevo (sondeo incremental cada 4 s con el panel abierto).
 *   `?before=<id>` → historial hacia atrás ("cargar mensajes anteriores").
 *   `?only=unread` → solo el contador (sondeo barato cada 30 s con el panel cerrado).
 * Devuelve también `me` para que el cliente sepa qué burbujas van a la derecha.
 */
export async function GET(req: NextRequest) {
  const u = await requireChatUser();
  if (!u) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    // Cualquier sondeo del chat prueba que el usuario sigue activo en la app.
    await touchPresence(u.userId);
    const conv = await getGroupConversation();
    const sp = req.nextUrl.searchParams;

    if (sp.get('only') === 'unread') {
      const unread = await getUnreadCount(conv.id, u.userId);
      return NextResponse.json({ data: { unread } });
    }

    const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
    const [messages, unread] = await Promise.all([
      listMessages(conv.id, { after: num(sp.get('after')), before: num(sp.get('before')), limit: num(sp.get('limit')) ?? 50 }),
      getUnreadCount(conv.id, u.userId),
    ]);

    return NextResponse.json({ data: { conversationId: conv.id, title: conv.title, me: u.userId, messages, unread } });
  } catch (err: any) {
    console.error('Chat grupal GET:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el chat.' }, { status: 500 });
  }
}

// POST — envía un mensaje al chat grupal.
export async function POST(req: NextRequest) {
  const u = await requireChatUser();
  if (!u) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const b = await req.json();
    const body = String(b?.body ?? '').trim();
    if (!body) return NextResponse.json({ error: 'El mensaje está vacío.' }, { status: 400 });
    if (body.length > MAX_LEN) return NextResponse.json({ error: `Máximo ${MAX_LEN} caracteres.` }, { status: 400 });

    const conv = await getGroupConversation();
    const message = await postMessage(conv.id, u.userId, body);
    return NextResponse.json({ data: message });
  } catch (err: any) {
    console.error('Chat grupal POST:', err.message);
    return NextResponse.json({ error: 'No se pudo enviar el mensaje.' }, { status: 500 });
  }
}
