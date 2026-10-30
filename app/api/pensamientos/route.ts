import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { listDays, listThoughts, createThought, publishedIdsOf, PUBLICADOS_MAX } from '@/lib/centralized/pensamientos-db';

export const dynamic = 'force-dynamic';

/** Límite de tamaño: un pensamiento puede ser una lectura amplia, pero no ilimitada. */
const MAX_LEN = 50000;

/**
 * GET — días con pensamientos del usuario + los pensamientos del día pedido (`?day=`).
 * La privacidad es POR FILA: solo se leen los del sujeto logueado, nunca por rol.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ data: { subject: null, days: [], thoughts: [] } });

    const day = req.nextUrl.searchParams.get('day') || undefined;
    // `?publicados=1`: solo los que están en la página de inicio (filtro del admin).
    const soloPublicados = user.role === 'admin' && req.nextUrl.searchParams.get('publicados') === '1';
    // `publishedIds` solo para el admin: es quien puede publicarlos en la landing (hasta
    // `PUBLICADOS_MAX`), y le sirve para ver cuáles tiene publicados ahora mismo.
    const [days, thoughts, publishedIds] = await Promise.all([
      listDays(subject),
      listThoughts(subject, soloPublicados ? undefined : day, 200, soloPublicados),
      user.role === 'admin' ? publishedIdsOf(subject) : Promise.resolve([] as number[]),
    ]);
    return NextResponse.json({ data: { subject, days, thoughts, publishedIds, publicadosMax: PUBLICADOS_MAX } });
  } catch (err: any) {
    console.error('Pensamientos list:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar los pensamientos.' }, { status: 500 });
  }
}

// POST — captura rápida de un pensamiento.
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const b = await req.json();
    const content = String(b?.content ?? '').trim();
    if (!content) return NextResponse.json({ error: 'El pensamiento está vacío.' }, { status: 400 });
    if (content.length > MAX_LEN) return NextResponse.json({ error: `Máximo ${MAX_LEN} caracteres.` }, { status: 400 });

    const data = await createThought(subject, content);
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Pensamientos create:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar el pensamiento.' }, { status: 500 });
  }
}
