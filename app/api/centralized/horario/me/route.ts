import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectHorario } from '@/lib/centralized/horario-db';
import { resolveSubject } from '@/lib/centralized/subject';
import { NextRequest, NextResponse } from 'next/server';

const EMPTY = { subject: null, tasks: [], schedule: [], auto: [], generated: [], social: [] };

// GET — horario del USUARIO ACTUAL (para "Mi día"). `?from&to` acota las auto-entradas.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ data: EMPTY }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ data: EMPTY });
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from') || undefined;
    const to = sp.get('to') || undefined;
    const data = await getSubjectHorario(subject.kind, subject.id, from, to);
    return NextResponse.json({ data: { subject, ...data } });
  } catch (err: any) {
    console.error('Horario me error:', err.message);
    return NextResponse.json({ data: EMPTY, error: err.message }, { status: 500 });
  }
}
