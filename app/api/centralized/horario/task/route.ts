import { getCurrentUser } from '@/lib/auth/jwt';
import { getTaskContext } from '@/lib/centralized/horario-db';
import { NextRequest, NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — contexto de una tarea (alternativa): problemas, situaciones y causas asociadas.
export async function GET(req: NextRequest) {
  try {
    if (!(await guard())) return NextResponse.json({ data: null }, { status: 403 });
    const sp = req.nextUrl.searchParams;
    const kind = sp.get('subject_kind');
    const id = sp.get('subject_id');
    const alternativeId = Number(sp.get('alternative_id'));
    if (!kind || !id || !alternativeId) return NextResponse.json({ data: null });
    const data = await getTaskContext(kind, id, alternativeId);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Horario task context error:', err.message);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
