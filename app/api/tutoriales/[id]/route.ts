import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { isModuleKey } from '@/lib/dashboard/modules';
import { updateTutorial, deleteTutorial, parseYouTubeId } from '@/lib/tutoriales/db';

export const dynamic = 'force-dynamic';

/** PATCH — edita un tutorial (solo admin). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 });

    const b = await req.json();
    const patch: Record<string, unknown> = {};

    if (b?.module !== undefined) {
      if (!isModuleKey(String(b.module))) return NextResponse.json({ error: 'Módulo desconocido.' }, { status: 400 });
      patch.module = String(b.module);
    }
    if (b?.title !== undefined) {
      const title = String(b.title).trim();
      if (!title) return NextResponse.json({ error: 'El título es obligatorio.' }, { status: 400 });
      patch.title = title;
    }
    if (b?.description !== undefined) patch.description = b.description ? String(b.description).trim() : null;
    if (b?.url !== undefined) {
      const url = String(b.url).trim();
      const videoId = parseYouTubeId(url);
      if (!videoId) return NextResponse.json({ error: 'El enlace no parece de YouTube.' }, { status: 400 });
      patch.url = url;
      patch.videoId = videoId;
    }
    if (b?.orden !== undefined) patch.orden = Number(b.orden) || 0;
    if (b?.active !== undefined) patch.active = Boolean(b.active);

    const data = await updateTutorial(id, patch);
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Tutoriales update:', err.message);
    return NextResponse.json({ error: 'No se pudo actualizar el tutorial.' }, { status: 500 });
  }
}

/** DELETE — elimina un tutorial (solo admin). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Id inválido' }, { status: 400 });

    const ok = await deleteTutorial(id);
    if (!ok) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ data: { ok: true } });
  } catch (err: any) {
    console.error('Tutoriales delete:', err.message);
    return NextResponse.json({ error: 'No se pudo eliminar el tutorial.' }, { status: 500 });
  }
}
