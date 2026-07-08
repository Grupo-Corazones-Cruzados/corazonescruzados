import { getCurrentUser } from '@/lib/auth/jwt';
import { getCategoryGraph } from '@/lib/centralized/comandos-db';
import { NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?category_id= — grafo de la categoría (políticas → funciones).
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const categoryId = Number(new URL(req.url).searchParams.get('category_id'));
    if (!categoryId) return NextResponse.json({ error: 'Falta category_id' }, { status: 400 });
    return NextResponse.json({ data: await getCategoryGraph(categoryId) });
  } catch (err: any) {
    console.error('Comandos graph GET error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
