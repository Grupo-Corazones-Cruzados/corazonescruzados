import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { suggestPesosForPremisa } from '@/lib/centralized/pesos-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST { premisa_id } — la IA evalúa qué pesos existentes (no conectados) son pertinentes para la premisa.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { premisa_id } = await req.json();
    if (!premisa_id) return NextResponse.json({ error: 'Falta premisa_id' }, { status: 400 });
    const out = await suggestPesosForPremisa(Number(premisa_id));
    return NextResponse.json(out);
  } catch (err: any) {
    console.error('pesos-suggest error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
