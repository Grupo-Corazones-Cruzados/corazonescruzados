import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Allow up to 5 minutes for large audio files
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

    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|m4a|mp4|wav|ogg|webm)$/i)) {
      return NextResponse.json({ error: 'Solo archivos de audio (MP3, M4A, WAV, OGG, WEBM)' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'text',
    });

    const text = typeof transcription === 'string' ? transcription : (transcription as any).text || '';
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
