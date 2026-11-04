import { NextResponse } from 'next/server';
import { usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { rechazo } from '@/lib/espacio-trabajo/guardia';
import { borrarCarpetaVideo } from '@/lib/espacio-trabajo/claude-local';
import { borrarVideo, fijarSesionVideo, getVideo } from '@/lib/centralized/generacion-contenido-db';

export const dynamic = 'force-dynamic';
type Ruta = { params: Promise<{ videoId: string }> };

async function videoDe(videoId: string) {
  const user = await usuarioLocal();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return getVideo(Number(videoId), user.userId, user.role === 'admin');
}

/** `/clear` en el chat: el video sigue siendo el mismo, pero con una conversación nueva. */
export async function PATCH(req: Request, { params }: Ruta) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const v = await videoDe((await params).videoId);
  if (!v) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const { sesion_id: sesion } = await req.json();
  if (sesion !== null && !/^[0-9a-f-]{36}$/.test(String(sesion))) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 400 });
  await fijarSesionVideo(v.id, sesion);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ruta) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const v = await videoDe((await params).videoId);
  if (!v) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  try {
    await borrarCarpetaVideo(v);
    await borrarVideo(v.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
}
