import { NextResponse, type NextRequest } from 'next/server';
import { rechazo, usuarioLocal } from '@/lib/espacio-trabajo/guardia';
import {
  borrarAnimacion, guardarAnimacion, leerFicha, listarPersonajes, nombreSeguro,
} from '@/lib/herramientas/sprites';

export const dynamic = 'force-dynamic';

/**
 * Cortador de sprites (Herramientas). SOLO en la Mac: escribe en la carpeta del juego del
 * repositorio, así que va detrás del mismo candado que el Espacio de trabajo (en Railway, 404).
 */
async function puerta(req: Request): Promise<Response | null> {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const u = await usuarioLocal();
  if (!u || u.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  return null;
}

/** GET → personajes guardados · GET ?personaje=x → sus animaciones. */
export async function GET(req: NextRequest) {
  const no = await puerta(req);
  if (no) return no;
  const p = req.nextUrl.searchParams.get('personaje');
  if (!p) return NextResponse.json({ data: await listarPersonajes() });
  const personaje = nombreSeguro(p);
  if (!personaje) return NextResponse.json({ error: 'Nombre de personaje no válido' }, { status: 400 });
  return NextResponse.json({ data: await leerFicha(personaje) });
}

/** POST { personaje, nombre, png (base64), fotogramas, ancho, alto, fps, bucle } → guarda la tira. */
export async function POST(req: NextRequest) {
  const no = await puerta(req);
  if (no) return no;
  const c = await req.json().catch(() => null);
  const personaje = nombreSeguro(String(c?.personaje ?? ''));
  const nombre = nombreSeguro(String(c?.nombre ?? ''));
  if (!personaje) return NextResponse.json({ error: 'Falta el nombre del personaje' }, { status: 400 });
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre de la animación' }, { status: 400 });
  const entero = (v: unknown, min: number, max: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const fotogramas = entero(c.fotogramas, 1, 256);
  const ancho = entero(c.ancho, 1, 1024);
  const alto = entero(c.alto, 1, 1024);
  const fps = Number(c.fps);
  if (!fotogramas || !ancho || !alto || !(fps > 0 && fps <= 60)) {
    return NextResponse.json({ error: 'Datos de la animación no válidos' }, { status: 400 });
  }
  const b64 = String(c.png ?? '').replace(/^data:image\/png;base64,/, '');
  const png = Buffer.from(b64, 'base64');
  // Firma PNG: no se escribe en el disco nada que no sea una imagen.
  if (png.length < 8 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    return NextResponse.json({ error: 'La imagen no es un PNG' }, { status: 400 });
  }
  if (png.length > 20 * 1024 * 1024) return NextResponse.json({ error: 'La imagen pesa más de 20 MB' }, { status: 400 });
  const ficha = await guardarAnimacion({ personaje, nombre, png, fotogramas, ancho, alto, fps, bucle: c.bucle !== false });
  return NextResponse.json({ data: ficha });
}

/** DELETE ?personaje=x&nombre=y → borra esa animación (su PNG y su entrada). */
export async function DELETE(req: NextRequest) {
  const no = await puerta(req);
  if (no) return no;
  const personaje = nombreSeguro(req.nextUrl.searchParams.get('personaje') ?? '');
  const nombre = nombreSeguro(req.nextUrl.searchParams.get('nombre') ?? '');
  if (!personaje || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  return NextResponse.json({ data: await borrarAnimacion(personaje, nombre) });
}
