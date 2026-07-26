import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { getFeaturedThought, setFeaturedThought } from '@/lib/centralized/pensamientos-db';

export const dynamic = 'force-dynamic';

/**
 * Pensamiento DESTACADO en la página de inicio.
 *
 * `GET` es **público a propósito** (la landing no exige sesión) y por eso devuelve solo
 * el texto y la fecha: ni autor, ni id, ni categoría. Es la única vía por la que sale un
 * pensamiento de su dueño, y siempre porque el administrador lo publicó a mano.
 *
 * `POST` lo elige o lo quita, y es **solo para el admin** sobre **sus propios**
 * pensamientos (la pertenencia se comprueba en la capa de datos).
 */

/** GET — el pensamiento publicado, o `null`. Sin autenticación. */
export async function GET() {
  try {
    return NextResponse.json({ data: await getFeaturedThought() });
  } catch (err: any) {
    console.error('Pensamiento destacado GET:', err.message);
    // La landing no debe romperse por esto: si falla, simplemente no se muestra nada.
    return NextResponse.json({ data: null });
  }
}

/** POST — publica el pensamiento `id`, o lo quita con `id: null`. Solo admin. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const subject = await resolveSubject(user);
    if (!subject) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const b = await req.json();
    const raw = b?.id;
    const id = raw === null || raw === undefined ? null : Number(raw);
    if (id !== null && !Number.isInteger(id)) {
      return NextResponse.json({ error: 'Id inválido.' }, { status: 400 });
    }

    const ok = await setFeaturedThought(subject, id);
    if (!ok) return NextResponse.json({ error: 'Ese pensamiento no es tuyo.' }, { status: 404 });

    return NextResponse.json({ data: { featuredId: id } });
  } catch (err: any) {
    console.error('Pensamiento destacado POST:', err.message);
    return NextResponse.json({ error: 'No se pudo actualizar el destacado.' }, { status: 500 });
  }
}
