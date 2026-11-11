import { NextResponse } from 'next/server';
import { rechazo, usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { getContenido, listarVideos } from '@/lib/centralized/generacion-contenido-db';

/**
 * Lo común a las rutas de una idea: solo en la Mac, con sesión, y solo sobre una idea propia (el
 * administrador, sobre todas; con «Ver como», la sesión ES la del otro). Devuelve la idea y su video (uno).
 */
export async function ideaDe(req: Request, id: string, { tokenEnUrl = false } = {}) {
  const enUrl = tokenEnUrl && req.method === 'GET' ? new URL(req.url).searchParams.get('t') : null;
  const fuera = await rechazo(req, { enUrl });
  if (fuera) return { fuera };
  const user = await usuarioLocal(enUrl);
  if (!user || !['admin', 'member'].includes(user.role)) return { fuera: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  const isAdmin = user.role === 'admin';
  const c = await getContenido(Number(id), user.userId, isAdmin);
  if (!c) return { fuera: NextResponse.json({ error: 'No encontrado' }, { status: 404 }) };
  const videos = (await listarVideos(c.id, user.userId, isAdmin)) || [];
  return { user, c, video: (videos[0] as { id: number; carpeta: string; sesion_id: string | null; nombre: string; tamano: number }) || null };
}
