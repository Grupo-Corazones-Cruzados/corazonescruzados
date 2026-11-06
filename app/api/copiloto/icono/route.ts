import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { espacioHabilitado } from '@/lib/espacio-trabajo/guardia';

/** La imagen no está en el repositorio, que es público: se sirve de la Mac y solo en la instancia local. */
export async function GET() {
  if (!espacioHabilitado()) return new NextResponse('Not Found', { status: 404 });
  try {
    const png = fs.readFileSync(path.join(os.homedir(), '.gcc-copiloto/recursos/gumdramon.png'));
    return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400' } });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
