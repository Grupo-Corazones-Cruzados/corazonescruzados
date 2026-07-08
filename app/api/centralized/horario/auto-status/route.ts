import { getCurrentUser } from '@/lib/auth/jwt';
import { setAutoStatus } from '@/lib/centralized/horario-db';
import { NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// POST — marca el estado de una entrada automática (ticket/proyecto) por día.
// Body: { subject_kind, subject_id, alternativeId, day (YYYY-MM-DD), status }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const b = await req.json();
    const kind = String(b.subject_kind || '');
    const subjectId = String(b.subject_id || '');
    const alternativeId = Number(b.alternativeId);
    const day = String(b.day || '');
    const status = String(b.status || '');
    if (!kind || !subjectId || !alternativeId || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !['pending', 'completed', 'failed'].includes(status)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    await setAutoStatus(kind, subjectId, alternativeId, day, status as any);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Horario auto-status error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
