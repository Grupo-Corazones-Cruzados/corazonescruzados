import { NextResponse } from 'next/server';
import { rechazo, llamarServicio } from '@/lib/espacio-trabajo/guardia';
import { ErrorTranscripcion, transcribir } from '@/lib/ia/transcribir';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const fuera = await rechazo(req);
  if (fuera) return fuera;
  const form = await req.formData();
  const audio = form.get('audio');
  if (!(audio instanceof Blob) || !audio.size) return NextResponse.json({ error: 'No llegó el audio.' }, { status: 400 });
  // Los nombres de los proyectos ayudan a Whisper a escribirlos bien.
  let pista = 'código, programación, proyecto, sesión, GCC World';
  try {
    const r = await llamarServicio('/proyectos');
    if (r.ok) pista = `${pista}, ${(await r.json()).proyectos.map((p: { nombre: string }) => p.nombre).join(', ')}`.slice(0, 800);
  } catch { /* la pista es solo una ayuda */ }
  try {
    const texto = await transcribir(audio, String(form.get('mimeType') || audio.type || 'audio/webm'), pista);
    return NextResponse.json({ texto });
  } catch (e) {
    const mensaje = e instanceof ErrorTranscripcion ? e.message : 'No se pudo transcribir.';
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}
