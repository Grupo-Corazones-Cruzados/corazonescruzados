import { NextResponse } from 'next/server';
import { usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { rechazo } from '@/lib/espacio-trabajo/guardia';
import { crearVideo, listarVideos } from '@/lib/centralized/generacion-contenido-db';

export const dynamic = 'force-dynamic';
type Ruta = { params: Promise<{ id: string }> };

async function quien() {
  const user = await usuarioLocal();
  return user && ['admin', 'member'].includes(user.role) ? { userId: user.userId, isAdmin: user.role === 'admin' } : null;
}

export async function GET(req: Request, { params }: Ruta) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const g = await quien();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const data = await listarVideos(Number((await params).id), g.userId, g.isAdmin);
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ data });
}

/** Da de alta la ficha antes de subir el archivo: así una subida cortada se puede reanudar. */
export async function POST(req: Request, { params }: Ruta) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const g = await quien();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { nombre, tamano } = await req.json();
  if (typeof nombre !== 'string' || !nombre.trim() || !Number.isSafeInteger(tamano) || tamano <= 0) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
  }
  const data = await crearVideo(Number((await params).id), nombre.trim().slice(0, 200), tamano, g.userId, g.isAdmin);
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ data });
}
