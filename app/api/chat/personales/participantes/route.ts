import { NextRequest, NextResponse } from 'next/server';
import { guardScope } from '@/lib/chat/scope-guard';
import { participantsOf, type ScopeKind } from '@/lib/chat/participants';
import { describeUsers } from '@/lib/chat/chat-db';

export const dynamic = 'force-dynamic';

/**
 * GET `?kind=&ref=` — quiénes participan en el chat y su ESTADO DE CONEXIÓN en la app.
 * Solo lo puede pedir alguien que participe (mismo guard que el resto del chat).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get('kind');
  const ref = sp.get('ref');
  const g = await guardScope(kind, ref);
  if (!g.ok) return NextResponse.json({ error: 'No autorizado' }, { status: g.status });
  try {
    const relations = await participantsOf(kind as ScopeKind, String(ref));
    const people = await describeUsers(Object.keys(relations), relations);
    return NextResponse.json({ data: { people, online: people.filter((p) => p.online).length } });
  } catch (err: any) {
    console.error('Participantes:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar los participantes.' }, { status: 500 });
  }
}
