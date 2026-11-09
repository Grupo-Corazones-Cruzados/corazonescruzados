import fs from 'node:fs/promises';
import { NextResponse, type NextRequest } from 'next/server';
import { rechazo, usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import { rutaImagen } from '@/lib/herramientas/sprites';

export const dynamic = 'force-dynamic';

/** GET ?personaje=x&archivo=y.png → la tira guardada, para verla animada en el cortador. */
export async function GET(req: NextRequest) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const u = await usuarioLocal();
  if (!u || u.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const ruta = rutaImagen(req.nextUrl.searchParams.get('personaje') ?? '', req.nextUrl.searchParams.get('archivo') ?? '');
  if (!ruta) return NextResponse.json({ error: 'Archivo no válido' }, { status: 400 });
  try {
    const datos = await fs.readFile(ruta);
    return new NextResponse(new Uint8Array(datos), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No existe' }, { status: 404 });
  }
}
