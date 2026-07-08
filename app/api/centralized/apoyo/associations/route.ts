import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectLinkOptions, getAlternativeLink, setAlternativeLink } from '@/lib/centralized/apoyo-db';
import { NextRequest, NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — opciones (proyectos/tickets que el sujeto creó o participa) + los ya asociados
// a la alternativa. `?subject_kind&subject_id&alternative_id`.
export async function GET(req: NextRequest) {
  try {
    if (!(await guard())) return NextResponse.json({ data: null }, { status: 403 });
    const sp = req.nextUrl.searchParams;
    const kind = sp.get('subject_kind');
    const id = sp.get('subject_id');
    const alternativeId = Number(sp.get('alternative_id'));
    if (!kind || !id || !alternativeId) return NextResponse.json({ data: { available: { tickets: [], projects: [] }, linked: null } });
    // El asociado (chip) es rápido y se pide siempre; las OPCIONES (consulta pesada de
    // todos los tickets/proyectos) solo cuando se abre el selector (`?options=1`).
    const linked = await getAlternativeLink(alternativeId).catch((e) => { console.error('alt link error:', e.message); return null; });
    const available = sp.get('options') === '1'
      ? await getSubjectLinkOptions(kind, id).catch((e) => { console.error('link options error:', e.message); return { tickets: [], projects: [] }; })
      : { tickets: [], projects: [] };
    return NextResponse.json({ data: { available, linked } });
  } catch (err: any) {
    console.error('Apoyo associations GET error:', err.message);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

// POST — asocia/desasocia. Body: { alternativeId, kind: 'ticket'|'project', id, connect }.
export async function POST(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const b = await req.json();
    const alternativeId = Number(b.alternativeId);
    const kind = b.kind === 'project' ? 'project' : b.kind === 'ticket' ? 'ticket' : null;
    const id = b.id != null ? String(b.id) : '';
    if (!alternativeId || !kind || !id) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    await setAlternativeLink(alternativeId, kind, id, !!b.connect);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Apoyo associations POST error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
