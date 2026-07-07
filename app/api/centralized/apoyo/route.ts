import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectGraph } from '@/lib/centralized/apoyo-db';
import { NextRequest, NextResponse } from 'next/server';

/** Grafo de Apoyo y Autoayuda de un sujeto (candidato/miembro). Requiere sesión de miembro/admin. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !['admin', 'member'].includes(user.role)) {
      return NextResponse.json({ data: { nodes: [], edges: [] } }, { status: 403 });
    }
    const sp = req.nextUrl.searchParams;
    const kind = sp.get('subject_kind');
    const id = sp.get('subject_id');
    if (!kind || !id) return NextResponse.json({ data: { nodes: [], edges: [] } });

    const graph = await getSubjectGraph(kind, id);
    return NextResponse.json({ data: graph });
  } catch (err: any) {
    console.error('Apoyo graph error:', err.message);
    return NextResponse.json({ data: { nodes: [], edges: [] }, error: err.message }, { status: 500 });
  }
}
