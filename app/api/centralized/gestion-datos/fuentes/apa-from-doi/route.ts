import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { crossrefToApa } from '@/lib/centralized/scopus';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST { doi } — resuelve un DOI a una referencia APA completa vía Crossref (todos los autores).
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { doi } = await req.json();
    if (!doi?.trim()) return NextResponse.json({ error: 'Falta el DOI' }, { status: 400 });
    const apa = await crossrefToApa(doi);
    if (!apa) return NextResponse.json({ error: 'No se encontró el DOI en Crossref' }, { status: 404 });
    return NextResponse.json({ data: apa });
  } catch (err: any) {
    console.error('apa-from-doi error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
