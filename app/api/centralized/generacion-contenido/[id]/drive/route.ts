import { NextResponse } from 'next/server';
import { ideaDe } from '@/lib/centralized/idea-guardia';
import { subirADrive } from '@/lib/centralized/contenido-local';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

/** POST — «Subir» y «Actualizar»: las piezas al Drive de la empresa. El proyecto sigue en la Mac. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await ideaDe(req, (await params).id);
  if (r.fuera) return r.fuera;
  if (!r.video) return NextResponse.json({ error: 'La idea no tiene video.' }, { status: 400 });
  try {
    return NextResponse.json({ drive: await subirADrive(r.video, r.c) });
  } catch (e: any) {
    console.error('Subir a Drive:', e?.message);
    return NextResponse.json({ error: e?.message || 'No se pudo subir.' }, { status: 500 });
  }
}
