import { NextResponse } from 'next/server';
import { ideaDe } from '@/lib/centralized/idea-guardia';
import { publicarIdea } from '@/lib/centralized/publicar-idea';

export const dynamic = 'force-dynamic';

/** POST { titulo, descripcion, privacidad, programada } — publica en todas las redes del talento. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await ideaDe(req, (await params).id);
  if (r.fuera) return r.fuera;
  if (!r.video) return NextResponse.json({ error: 'La idea no tiene video.' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  if (!['private', 'unlisted', 'public'].includes(b.privacidad)) return NextResponse.json({ error: 'Visibilidad inválida.' }, { status: 400 });
  if (!String(b.titulo || '').trim()) return NextResponse.json({ error: 'Falta el título.' }, { status: 400 });
  if (b.programada && !(new Date(b.programada).getTime() > Date.now() + 15 * 60_000)) return NextResponse.json({ error: 'La hora debe ser al menos 15 minutos después de ahora.' }, { status: 400 });
  try {
    await publicarIdea(r.video, r.c.user_id, r.c.talento, {
      titulo: String(b.titulo).trim(), descripcion: String(b.descripcion || ''), privacidad: b.privacidad, programada: b.programada || null,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'No se pudo publicar.' }, { status: 400 });
  }
}
