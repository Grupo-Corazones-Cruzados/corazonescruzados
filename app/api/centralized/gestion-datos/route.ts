import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { getProblematicaGraph } from '@/lib/centralized/gestion-datos-db';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?problematica_id= — grafo de una problemática (nodes/edges).
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = Number(new URL(req.url).searchParams.get('problematica_id'));
    if (!id) return NextResponse.json({ data: { nodes: [], edges: [] } });
    return NextResponse.json({ data: await getProblematicaGraph(id) });
  } catch (err: any) {
    console.error('GD graph GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
