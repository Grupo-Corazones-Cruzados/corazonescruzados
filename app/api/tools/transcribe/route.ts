import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { writeFile, unlink, createReadStream } from 'fs';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';

// Allow up to 5 minutes for large audio files
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let tempPath = '';
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

    // Write file to disk since OpenAI SDK needs a proper file handle
    const ext = file.name.split('.').pop() || 'm4a';
    tempPath = join(tmpdir(), `transcribe-${randomUUID()}.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tempPath, buffer);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Create a file object compatible with the OpenAI SDK
    const fileForApi = await toFile(fs.readFile(tempPath), file.name, {
      type: file.type || 'audio/mp4',
    });

    const transcription = await openai.audio.transcriptions.create({
      file: fileForApi,
      model: 'whisper-1',
    });

    // Cleanup temp file
    try { await fs.unlink(tempPath); } catch {}

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
    if (tempPath) { try { await fs.unlink(tempPath); } catch {} }
    console.error('Transcribe error:', err.message);
    return NextResponse.json({ error: err.message || 'Error al transcribir' }, { status: 500 });
  }
}
