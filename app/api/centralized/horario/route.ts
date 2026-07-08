import { getCurrentUser } from '@/lib/auth/jwt';
import { getSubjectHorario, setTaskLabels } from '@/lib/centralized/horario-db';
import { VALORES_SET } from '@/lib/centralized/valores';
import { TALENTOS_SET } from '@/lib/centralized/talentos';
import { NextRequest, NextResponse } from 'next/server';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return user;
}

// GET — tareas (alternativas del sujeto) + su calendario asignado.
export async function GET(req: NextRequest) {
  try {
    if (!(await guard())) return NextResponse.json({ data: { tasks: [], schedule: [], auto: [] } }, { status: 403 });
    const sp = req.nextUrl.searchParams;
    const kind = sp.get('subject_kind');
    const id = sp.get('subject_id');
    const from = sp.get('from') || undefined;
    const to = sp.get('to') || undefined;
    if (!kind || !id) return NextResponse.json({ data: { tasks: [], schedule: [], auto: [] } });
    const data = await getSubjectHorario(kind, id, from, to);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Horario GET error:', err.message);
    return NextResponse.json({ data: { tasks: [], schedule: [], auto: [] }, error: err.message }, { status: 500 });
  }
}

// PATCH — fija las etiquetas (valores/talentos) de una tarea. Valida contra las listas
// canónicas (VALORES por key, TALENTOS por etiqueta) para no guardar valores inválidos.
export async function PATCH(req: Request) {
  try {
    if (!(await guard())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const b = await req.json();
    const id = Number(b.alternativeId);
    if (!id) return NextResponse.json({ error: 'Falta la tarea' }, { status: 400 });
    const values = Array.isArray(b.values) ? b.values.map(String).filter((v: string) => VALORES_SET.has(v)) : [];
    const talents = Array.isArray(b.talents) ? b.talents.map(String).filter((t: string) => TALENTOS_SET.has(t)) : [];
    await setTaskLabels(id, values, talents);
    return NextResponse.json({ ok: true, values, talents });
  } catch (err: any) {
    console.error('Horario PATCH error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
