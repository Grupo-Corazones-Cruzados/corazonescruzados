import { NextResponse } from 'next/server';
import { contextoApi } from '@/lib/inquilino';
import { iaConfigurada, transcribir } from '@/lib/ia';

export const dynamic = 'force-dynamic';
const MAXIMO = 25 * 1024 * 1024;

/** El audio del micrófono → texto. Lo llama el componente `Dictado` al soltar el botón. */
export async function POST(peticion: Request, { params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const ctx = await contextoApi(institucion, 'planificar');
  if (!ctx) return NextResponse.json({ error: 'Sin autorización' }, { status: 401 });
  if (!iaConfigurada()) return NextResponse.json({ error: 'La transcripción no está configurada.' }, { status: 503 });

  const datos = await peticion.formData();
  const audio = datos.get('audio');
  if (!(audio instanceof Blob) || !audio.size) return NextResponse.json({ error: 'No llegó ningún audio.' }, { status: 400 });
  if (audio.size > MAXIMO) return NextResponse.json({ error: 'La grabación es demasiado larga (máximo 25 MB).' }, { status: 413 });

  try {
    const ext = (audio.type.split('/')[1] || 'webm').split(';')[0];
    const texto = await transcribir(audio, `dictado.${ext}`);
    return NextResponse.json({ texto });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'No se pudo transcribir.' }, { status: 502 });
  }
}
