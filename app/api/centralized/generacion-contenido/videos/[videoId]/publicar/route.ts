import { NextResponse } from 'next/server';
import { rechazo, usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { getContenido, getVideo } from '@/lib/centralized/generacion-contenido-db';
import { archivoFinal, creditosObligatorios, listarCuentas, listarPublicaciones, publicarVideo } from '@/lib/centralized/publicar';

export const dynamic = 'force-dynamic';
type Ruta = { params: Promise<{ videoId: string }> };

/** Publicar es de quien administra las cuentas: un miembro con acceso a su idea no sale en los canales del grupo. */
async function contexto(videoId: string) {
  const user = await usuarioLocal();
  if (user?.role !== 'admin') return null;
  const video = await getVideo(Number(videoId), user.userId, true);
  return video ? { user, video } : null;
}

export async function GET(req: Request, { params }: Ruta) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const c = await contexto((await params).videoId);
  if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const idea = await getContenido(c.video.contenido_id, c.user.userId, true);
  const meta = (idea?.entregables || []).find((e: any) => e.tipo === 'metadatos')?.datos || {};
  const creditos = creditosObligatorios(c.video.carpeta);
  return NextResponse.json({
    cuentas: await listarCuentas(),
    publicaciones: await listarPublicaciones(c.video.id),
    final: archivoFinal(c.video.carpeta) ? { nombre: archivoFinal(c.video.carpeta)!.nombre, tamano: archivoFinal(c.video.carpeta)!.tamano } : null,
    sugerido: {
      titulo: idea?.titulo || idea?.tema || c.video.nombre,
      descripcion: creditos.length ? `\n\nMúsica:\n${creditos.join('\n')}` : '',
      etiquetas: Array.isArray(meta.palabras_clave) ? meta.palabras_clave : [],
    },
  });
}

export async function POST(req: Request, { params }: Ruta) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const c = await contexto((await params).videoId);
  if (!c) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const b = await req.json();
  if (!['private', 'unlisted', 'public'].includes(b.privacidad)) return NextResponse.json({ error: 'Privacidad inválida.' }, { status: 400 });
  if (b.programada && !(new Date(b.programada).getTime() > Date.now() + 15 * 60_000)) return NextResponse.json({ error: 'La hora debe ser al menos 15 minutos después de ahora.' }, { status: 400 });
  try {
    const id = await publicarVideo(c.video, Number(b.cuenta_id), {
      titulo: String(b.titulo || ''), descripcion: String(b.descripcion || ''), etiquetas: Array.isArray(b.etiquetas) ? b.etiquetas.map(String) : [],
      privacidad: b.privacidad, programada: b.programada || null,
    });
    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
