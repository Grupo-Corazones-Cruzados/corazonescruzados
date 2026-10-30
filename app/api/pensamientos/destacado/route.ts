import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { getPublishedThoughts, setThoughtPublished, PUBLICADOS_MAX } from '@/lib/centralized/pensamientos-db';

export const dynamic = 'force-dynamic';

/**
 * Pensamientos PUBLICADOS en la página de inicio (hasta `PUBLICADOS_MAX`, desde el 2026-10-30;
 * antes era uno solo).
 *
 * `GET` es **público a propósito** (la landing no exige sesión) y por eso devuelve solo el
 * texto y la fecha: ni autor, ni id, ni categoría. Es la única vía por la que sale un
 * pensamiento de su dueño, y siempre porque el administrador lo publicó a mano.
 * Devuelve `lista` (todos) y `data` (el último publicado, por compatibilidad).
 *
 * `POST { id, publicar }` lo publica o lo retira, y es **solo para el admin** sobre **sus
 * propios** pensamientos (la pertenencia se comprueba en la capa de datos).
 */

/** GET — los pensamientos publicados. Sin autenticación. */
export async function GET() {
  try {
    const lista = await getPublishedThoughts();
    return NextResponse.json({ data: lista[0] ?? null, lista });
  } catch (err: any) {
    console.error('Pensamientos publicados GET:', err.message);
    // La landing no debe romperse por esto: si falla, simplemente no se muestra nada.
    return NextResponse.json({ data: null, lista: [] });
  }
}

/** POST — publica (`publicar: true`) o retira el pensamiento `id`. Solo admin. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const b = await req.json();
    const id = Number(b?.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 });
    const publicar = b?.publicar !== false;

    const r = await setThoughtPublished(subject, id, publicar);
    if (r === 'no-es-tuyo') return NextResponse.json({ error: 'Ese pensamiento no es tuyo.' }, { status: 404 });
    if (r === 'tope') {
      return NextResponse.json(
        { error: `Ya hay ${PUBLICADOS_MAX} pensamientos en la página de inicio. Retira uno para publicar este.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ data: { id, publicado: publicar } });
  } catch (err: any) {
    console.error('Pensamientos publicados POST:', err.message);
    return NextResponse.json({ error: 'No se pudo actualizar la página de inicio.' }, { status: 500 });
  }
}
