import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { isModuleKey } from '@/lib/dashboard/modules';
import {
  listByModule, listAll, countsByModule, createTutorial, parseYouTubeId,
} from '@/lib/tutoriales/db';

export const dynamic = 'force-dynamic';

/**
 * GET — tutoriales de un módulo.
 *  · `?module=/dashboard/tickets` → los ACTIVOS de ese módulo (cualquier usuario).
 *  · `?counts=1`                  → `{ '/dashboard/x': 2 }` para pintar el botón ⓘ.
 *  · `?all=1`                     → todos, incluidos inactivos (solo admin).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sp = req.nextUrl.searchParams;

    if (sp.get('counts')) {
      return NextResponse.json({ data: await countsByModule() });
    }
    if (sp.get('all')) {
      if (user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      return NextResponse.json({ data: await listAll() });
    }

    const module = sp.get('module') || '';
    if (!isModuleKey(module)) return NextResponse.json({ error: 'Módulo desconocido' }, { status: 400 });
    return NextResponse.json({ data: await listByModule(module) });
  } catch (err: any) {
    console.error('Tutoriales list:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar los tutoriales.' }, { status: 500 });
  }
}

/** POST — alta de un tutorial (solo admin). */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const b = await req.json();
    const module = String(b?.module ?? '');
    const title = String(b?.title ?? '').trim();
    const url = String(b?.url ?? '').trim();

    if (!isModuleKey(module)) return NextResponse.json({ error: 'Elige un módulo válido.' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'El título es obligatorio.' }, { status: 400 });

    const videoId = parseYouTubeId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'El enlace no parece de YouTube. Pega la URL del video (o su ID).' },
        { status: 400 },
      );
    }

    const data = await createTutorial({
      module,
      title,
      description: b?.description ? String(b.description).trim() : null,
      url,
      videoId,
      orden: typeof b?.orden === 'number' ? b.orden : undefined,
      active: typeof b?.active === 'boolean' ? b.active : undefined,
    });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Tutoriales create:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar el tutorial.' }, { status: 500 });
  }
}
