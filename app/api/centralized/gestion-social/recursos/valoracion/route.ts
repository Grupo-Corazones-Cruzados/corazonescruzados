import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { canAccessSystem } from '@/lib/centralized/system-access';
import { getAssessment, saveAssessment, type AssessmentItem } from '@/lib/centralized/valoraciones-db';

export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!(await canAccessSystem(user.userId, user.role, 'gestion-social'))) return null;
  return user;
}

function subjectOf(sp: URLSearchParams) {
  const kind = sp.get('kind') === 'candidate' ? 'candidate' : sp.get('kind') === 'member' ? 'member' : null;
  const id = sp.get('id');
  return kind && id ? { kind, id } : null;
}

// GET — valoración actual del sujeto.
export async function GET(req: NextRequest) {
  const user = await guard();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const s = subjectOf(req.nextUrl.searchParams);
    if (!s) return NextResponse.json({ error: 'Falta el sujeto.' }, { status: 400 });
    const data = await getAssessment(s.kind, s.id);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Valoración GET:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar la valoración.' }, { status: 500 });
  }
}

/**
 * PUT — guarda la valoración COMPLETA del sujeto (reemplaza, no acumula).
 * Es PUT y no POST a propósito: la operación es idempotente y sustituye el recurso entero,
 * que es exactamente la semántica pedida (hoy 5 puntos, mañana 3 → queda en 3).
 */
export async function PUT(req: NextRequest) {
  const user = await guard();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const s = subjectOf(req.nextUrl.searchParams);
    if (!s) return NextResponse.json({ error: 'Falta el sujeto.' }, { status: 400 });
    const b = await req.json();
    const items: AssessmentItem[] = Array.isArray(b?.items) ? b.items : [];
    const res = await saveAssessment(s.kind, s.id, items, user.userId);
    return NextResponse.json({ ok: true, ...res });
  } catch (err: any) {
    console.error('Valoración PUT:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar la valoración.' }, { status: 500 });
  }
}
