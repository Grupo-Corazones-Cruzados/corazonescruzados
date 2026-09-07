import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { buscarReferencias, memberIdDeUsuario } from '@/lib/centralized/generacion-contenido-db';

// El buscador de REFERENCIA HISTÓRICA: productos, proyectos y tickets del usuario. El admin
// busca en todos.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const tipo = (searchParams.get('tipo') || 'todos') as any;
    const isAdmin = user.role === 'admin';
    const memberId = isAdmin ? null : await memberIdDeUsuario(user.userId);
    const data = await buscarReferencias(user.userId, memberId, isAdmin, q, tipo);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Generación de contenido referencias error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
