import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { searchScopus } from '@/lib/centralized/scopus';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET ?q= — busca en Scopus y devuelve resultados con su referencia APA de arranque.
export async function GET(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const q = new URL(req.url).searchParams.get('q') || '';
    if (!q.trim()) return NextResponse.json({ error: 'Falta la consulta' }, { status: 400 });
    return NextResponse.json({ data: await searchScopus(q, 12) });
  } catch (err: any) {
    console.error('Scopus search error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
