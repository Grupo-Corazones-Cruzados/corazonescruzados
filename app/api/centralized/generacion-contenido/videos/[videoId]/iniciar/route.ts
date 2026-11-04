import { NextResponse } from 'next/server';
import { usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { llamarServicio, rechazo } from '@/lib/espacio-trabajo/guardia';
import { fijarSesionVideo, getContenido, getVideo } from '@/lib/centralized/generacion-contenido-db';
import { contextoDeIdea } from '@/lib/centralized/generacion-contenido';

export const dynamic = 'force-dynamic';

/** Con el archivo ya subido, abre la sesión dedicada y lanza el agente. Repetirlo no abre otra. */
export async function POST(req: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const user = await usuarioLocal();
  if (!user || !['admin', 'member'].includes(user.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const isAdmin = user.role === 'admin';
  const v = await getVideo(Number((await params).videoId), user.userId, isAdmin);
  if (!v) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (v.sesion_id) return NextResponse.json({ data: { ...v } });
  const c = await getContenido(v.contenido_id, user.userId, isAdmin);
  const r = await llamarServicio(`/videos/${encodeURIComponent(v.carpeta)}/iniciar`, {
    method: 'POST',
    body: JSON.stringify({ nombre: v.nombre, tamano: v.tamano, tema: c.titulo || c.tema, titulo: v.nombre, contexto: contextoDeIdea(c) }),
  }).catch(() => null);
  if (!r) return NextResponse.json({ error: 'El servicio local no está en marcha.' }, { status: 503 });
  const j = await r.json();
  if (!r.ok) return NextResponse.json({ error: j.error || 'No se pudo abrir la sesión.' }, { status: r.status });
  await fijarSesionVideo(v.id, j.id);
  return NextResponse.json({ data: { ...v, sesion_id: j.id } });
}
