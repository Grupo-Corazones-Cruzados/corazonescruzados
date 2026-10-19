import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { abrir } from '@/lib/media/drive';
import type { Archivo } from '@/lib/enlaces';

/**
 * Devuelve un archivo de Drive como descarga, solo si está en `archivos` (la lista de ESTA fila):
 * con el id de Drive a secas se podría leer cualquier archivo de la cuenta de la empresa.
 */
export async function descargaDeDrive(archivos: Archivo[], fileId: string): Promise<Response> {
  const a = (archivos || []).find((x) => x.id === fileId);
  if (!a) return new NextResponse(null, { status: 404 });
  try {
    const d = await abrir(fileId);
    const headers: Record<string, string> = {
      'Content-Type': a.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (d.contentLength) headers['Content-Length'] = d.contentLength;
    return new Response(Readable.toWeb(d.stream) as ReadableStream, { headers });
  } catch (err: any) {
    console.error('[entregas] no se pudo leer de Drive', fileId, err?.message);
    return new NextResponse(null, { status: 502 });
  }
}
