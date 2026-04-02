import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo de audio requerido' }, { status: 400 });
    }

    if (!file.name.match(/\.(mp3|m4a|mp4|wav|ogg|webm)$/i)) {
      return NextResponse.json({ error: 'Solo archivos de audio (MP3, M4A, WAV, OGG, WEBM)' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Convert File to buffer and create OpenAI-compatible file directly (no disk write)
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileForApi = await toFile(buffer, file.name);

    const transcription = await openai.audio.transcriptions.create({
      file: fileForApi,
      model: 'whisper-1',
    });

    const text = typeof transcription === 'string' ? transcription : transcription.text || '';

    if (!text.trim()) {
      return NextResponse.json({ error: 'No se pudo extraer texto del audio' }, { status: 400 });
    }

    const originalName = file.name.replace(/\.[^.]+$/, '');

    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${originalName}.txt"`,
      },
    });
  } catch (err: any) {
    console.error('Transcribe error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al transcribir' }, { status: 500 });
  }
}
