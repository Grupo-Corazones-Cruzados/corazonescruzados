import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getPromptDoc, savePromptDoc, MAX_HTML } from '@/lib/admin/prompts';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ projectId: string }> };

async function projectIdOf(ctx: Ctx): Promise<number | null> {
  const { projectId } = await ctx.params;
  const id = Number(projectId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** GET — el documento del proyecto (vacío si aún no tiene). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = await projectIdOf(ctx);
    if (!id) return NextResponse.json({ error: 'Proyecto inválido' }, { status: 400 });
    const doc = await getPromptDoc(id);
    if (!doc) return NextResponse.json({ error: 'El proyecto no existe' }, { status: 404 });
    return NextResponse.json({ data: doc });
  } catch (err: any) {
    console.error('Prompts get:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el documento.' }, { status: 500 });
  }
}

/**
 * PUT — guarda el documento. Cuerpo `{ html, baseUpdatedAt }`: `baseUpdatedAt` es la fecha
 * del documento que tenía abierto quien guarda; si otro guardó después, 409 y no se pisa.
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const id = await projectIdOf(ctx);
    if (!id) return NextResponse.json({ error: 'Proyecto inválido' }, { status: 400 });

    const b = await req.json().catch(() => null);
    const html = typeof b?.html === 'string' ? b.html : null;
    const base = typeof b?.baseUpdatedAt === 'string' ? b.baseUpdatedAt : null;
    if (html === null) return NextResponse.json({ error: 'Falta el contenido' }, { status: 400 });
    if (html.length > MAX_HTML) {
      return NextResponse.json({ error: 'El documento es demasiado grande para guardarse.' }, { status: 413 });
    }
    if (!(await getPromptDoc(id))) return NextResponse.json({ error: 'El proyecto no existe' }, { status: 404 });

    const r = await savePromptDoc(id, html, base, user.userId);
    if (!r.ok) {
      return NextResponse.json(
        { error: 'El documento cambió en otra ventana.', updatedAt: r.updatedAt },
        { status: 409 },
      );
    }
    return NextResponse.json({ data: r });
  } catch (err: any) {
    console.error('Prompts save:', err.message);
    return NextResponse.json({ error: 'No se pudo guardar el documento.' }, { status: 500 });
  }
}
