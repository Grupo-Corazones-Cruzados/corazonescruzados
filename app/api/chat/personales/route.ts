import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { openScopesFor } from '@/lib/chat/participants';
import { ensureScopedConversations, summarizeConversations, touchPresence } from '@/lib/chat/chat-db';

export const dynamic = 'force-dynamic';

/**
 * GET — chats PERSONALES abiertos del usuario: uno por cada ticket, proyecto o evento NO
 * completado en el que participa. Trae los no leídos y una vista previa del último mensaje.
 *
 * También registra el latido de presencia: este endpoint lo sondea el panel cada 30 s.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    await touchPresence(user.userId);

    const scopes = await openScopesFor(user.userId);
    if (scopes.length === 0) {
      return NextResponse.json({ data: { me: user.userId, chats: [], unreadTotal: 0 } });
    }

    const convs = await ensureScopedConversations(scopes.map((s) => ({ kind: s.kind, refId: s.refId, title: s.title })));
    const ids = scopes.map((s) => convs.get(`${s.kind}:${s.refId}`)).filter((x): x is number => typeof x === 'number');
    const summary = await summarizeConversations(ids, user.userId);

    const chats = scopes.map((s) => {
      const id = convs.get(`${s.kind}:${s.refId}`);
      const sum = id != null ? summary[id] : undefined;
      return {
        kind: s.kind, refId: s.refId, title: s.title, status: s.status,
        conversationId: id ?? null,
        unread: sum?.unread ?? 0,
        lastAt: sum?.lastAt ?? null,
        lastBody: sum?.lastBody ?? null,
      };
    // Los que tienen mensajes recientes primero; los vacíos, al final.
    }).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));

    const unreadTotal = chats.reduce((n, c) => n + c.unread, 0);
    return NextResponse.json({ data: { me: user.userId, chats, unreadTotal } });
  } catch (err: any) {
    console.error('Chats personales:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar los chats.' }, { status: 500 });
  }
}
