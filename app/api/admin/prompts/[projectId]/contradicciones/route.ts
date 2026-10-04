import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { getPromptDoc, MAX_HTML } from '@/lib/admin/prompts';
import { htmlToMarkdown } from '@/lib/admin/prompts-md';
import { validarContradicciones, MAX_TEXTO_NUEVO } from '@/lib/admin/contradicciones';
import { iaConfigurada } from '@/lib/ia/openai';

export const dynamic = 'force-dynamic';
// Un documento largo con razonamiento alto puede tardar más de un minuto.
export const maxDuration = 300;

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * POST — ¿el texto nuevo contradice el documento? Cuerpo `{ html, texto }`.
 *
 * `html` es lo que hay EN PANTALLA, no lo último guardado: el guardado va con 1,2 s de
 * retraso y se valida lo que el usuario está viendo. Sin `html` se usa el guardado.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const { projectId } = await ctx.params;
    const id = Number(projectId);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Proyecto inválido' }, { status: 400 });
    if (!iaConfigurada()) return NextResponse.json({ error: 'La IA no está configurada en el servidor.' }, { status: 503 });

    const b = await req.json().catch(() => null);
    const texto = typeof b?.texto === 'string' ? b.texto : '';
    if (texto.length > MAX_TEXTO_NUEVO) {
      return NextResponse.json({ error: `El texto nuevo pasa de ${MAX_TEXTO_NUEVO.toLocaleString('es-ES')} caracteres.` }, { status: 413 });
    }

    const doc = await getPromptDoc(id);
    if (!doc) return NextResponse.json({ error: 'El proyecto no existe' }, { status: 404 });
    const html = typeof b?.html === 'string' ? b.html : doc.html;
    if (html.length > MAX_HTML) return NextResponse.json({ error: 'El documento es demasiado grande.' }, { status: 413 });

    const documentoMd = htmlToMarkdown(html);
    if (!documentoMd.trim()) {
      return NextResponse.json({ error: 'El documento está vacío: no hay nada con qué comparar.' }, { status: 400 });
    }

    const data = await validarContradicciones({ titulo: doc.title, documentoMd, textoNuevo: texto });
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Prompts contradicciones:', err.message);
    return NextResponse.json({ error: err.message || 'No se pudo validar el documento.' }, { status: 500 });
  }
}
