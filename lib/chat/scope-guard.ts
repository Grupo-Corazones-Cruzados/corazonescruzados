import { getCurrentUser } from '@/lib/auth/jwt';
import { canAccessScope, type ScopeKind } from '@/lib/chat/participants';
import { getOrCreateScopedConversation, touchPresence } from '@/lib/chat/chat-db';

/**
 * Guard común de los chats de ticket/proyecto/experiencia.
 *
 * La autorización se calcula EN CADA PETICIÓN a partir de quién participa hoy en el origen
 * (no hay tabla de miembros de conversación): si alguien deja de participar, pierde el acceso
 * de inmediato. Devuelve además la conversación, creándola la primera vez que alguien escribe.
 *
 * De paso registra el LATIDO de presencia: cualquier petición del chat prueba que el usuario
 * está activo en la app, así que no hace falta un canal aparte.
 */
export type Guarded =
  | { ok: true; userId: string; conversationId: number }
  | { ok: false; status: 400 | 401 | 403 };

const KINDS: ScopeKind[] = ['ticket', 'project', 'experience'];

export async function guardScope(kindRaw: string | null, refRaw: string | null): Promise<Guarded> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, status: 401 };

  const kind = KINDS.find((k) => k === kindRaw);
  const refId = (refRaw || '').trim();
  if (!kind || !refId) return { ok: false, status: 400 };

  if (!(await canAccessScope(user.userId, kind, refId))) return { ok: false, status: 403 };

  await touchPresence(user.userId);
  const conv = await getOrCreateScopedConversation(kind, refId);
  return { ok: true, userId: user.userId, conversationId: conv.id };
}
