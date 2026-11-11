import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ideaDe } from '@/lib/centralized/idea-guardia';
import { leerManifiesto, piezasDe, rutaSegura } from '@/lib/centralized/contenido-local';

export const dynamic = 'force-dynamic';
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };

/** GET ?ruta= — una pieza para verla en el panel. Solo las del manifiesto, nunca otra ruta. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Lo pide un `<img>` o un `<video>`: dentro del marco de la app no hay cookie ni cabecera, el token va en `t`.
  const r = await ideaDe(req, (await params).id, { tokenEnUrl: true });
  if (r.fuera) return r.fuera;
  if (!r.video) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const rel = new URL(req.url).searchParams.get('ruta') || '';
  const pieza = piezasDe(r.video.carpeta, leerManifiesto(r.video.carpeta)).find((p) => p.ruta === rel);
  const abs = pieza && rutaSegura(r.video.carpeta, rel);
  if (!abs) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const tamano = fs.statSync(abs).size;
  const tipo = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  const rango = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
  if (rango) {
    const ini = Number(rango[1]);
    const fin = Math.min(rango[2] ? Number(rango[2]) : ini + 8 * 1024 * 1024 - 1, tamano - 1);
    return new Response(fs.createReadStream(abs, { start: ini, end: fin }) as any, {
      status: 206, headers: { 'Content-Type': tipo, 'Content-Range': `bytes ${ini}-${fin}/${tamano}`, 'Accept-Ranges': 'bytes', 'Content-Length': String(fin - ini + 1), 'Cache-Control': 'no-store' },
    });
  }
  return new Response(fs.createReadStream(abs) as any, { headers: { 'Content-Type': tipo, 'Content-Length': String(tamano), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' } });
}
