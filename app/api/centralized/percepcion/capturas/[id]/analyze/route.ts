import { getCurrentUser } from '@/lib/auth/jwt';
import { getCapturaFotos, setCapturaEstado, setCapturaResultado, setCapturaError } from '@/lib/centralized/percepcion-db';
import { analizarEntorno, type ImagenEntrada } from '@/lib/centralized/percepcion-agent';
import { NextRequest, NextResponse } from 'next/server';

// El análisis encadena la lectura de N imágenes por el Claude CLI local (puede tardar).
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: Number(user.userId), isAdmin: user.role === 'admin' };
}

/** Convierte una URL almacenada (Cloudinary http(s) o data URI base64) en buffer + extensión. */
async function fetchImagen(url: string): Promise<ImagenEntrada> {
  if (url.startsWith('data:')) {
    const m = /^data:image\/(\w+);base64,([\s\S]*)$/.exec(url);
    if (!m) throw new Error('Imagen embebida inválida');
    return { buffer: Buffer.from(m[2], 'base64'), ext: m[1].toLowerCase() };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  const ext = /(png|jpe?g|webp|gif)/.exec(ct)?.[1]?.replace('jpeg', 'jpg') || (url.split('.').pop() || 'jpg').toLowerCase();
  return { buffer, ext };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const capturaId = Number(id);
  try {
    const urls = await getCapturaFotos(capturaId, g.userId, g.isAdmin);
    if (!urls) return NextResponse.json({ error: 'Captura no encontrada' }, { status: 404 });
    if (!urls.length) return NextResponse.json({ error: 'La captura no tiene fotos' }, { status: 400 });

    await setCapturaEstado(capturaId, 'analizando');
    const imagenes = await Promise.all(urls.map(fetchImagen));
    const analisis = await analizarEntorno(imagenes);
    await setCapturaResultado(capturaId, analisis.resumen, analisis.elementos);
    return NextResponse.json({ ok: true, resumen: analisis.resumen, elementos: analisis.elementos });
  } catch (err: any) {
    await setCapturaError(capturaId, err.message || 'Error al analizar').catch(() => {});
    return NextResponse.json({ error: err.message || 'Error al analizar' }, { status: 500 });
  }
}
